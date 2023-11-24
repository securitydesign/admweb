// Load() - accepts ADM content and outputs gherkinDocument object.
function ADMToGraphviz(adm_content) {
    // Define ADM as a custom dialect
    DIALECT_DICT['adm'] = {
        "feature": ["Model"],
        "background": ["Assumption"],
        "scenario": ["Attack", "Defense"],
        "rule": ["Policy"],
        "examples": ["Examples"],
        "given": ["Given"],
        "when": ["When"],
        "then": ["Then"],
        "and": ["And"],
        "but": ["But"],
        "scenarioOutline": ["Attack Outline", "Defense Outline"],
    };
    const gherkinDocument = Load(adm_content, 'adm');
    // fix gherkinDocument - replace 'And' and 'But' with the parent keyword - 'Given', 'When', or 'Then'
    fixGherkinDocument(gherkinDocument);
    const rules = [
        new AttackChainRule(),
        new DefenseChainRule(),
        new PreEmptiveDefenseRule(),
        new IncidentResponseRule(),
        new DefenseBreakerRule(),
        new TagBasedMatchingRule(),
    ];
    const edges = Match(gherkinDocument, rules);
    graphLines = CreateGraphvizGraph(gherkinDocument, edges);
    
    // merge all lines into a single string
    return graphLines.join('\n');
}

function fixGherkinDocument(gherkinDocument) {
    for (const child of gherkinDocument.feature.children) {
        if (child.scenario != null) {
            fixScenario(child.scenario);
        } else if (child.background != null) {
            fixBackground(child.background);
        }
        else if (child.rule != null) {
            fixRule(child.rule);
        }
    }
}

function fixScenario(scenario) {
    for (i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        if (step.keyword == 'And' || step.keyword == 'But') {
            step.keyword = scenario.steps[i - 1].keyword;
        }
    }
}

function fixBackground(background) {
    for (i = 0; i < background.steps.length; i++) {
        const step = background.steps[i];
        if (step.keyword == 'And' || step.keyword == 'But') {
            step.keyword = background.steps[i - 1].keyword;
        }
    }
}

function fixRule(rule) {
    for (child of rule.children) {
        if (child.scenario != null) {
            fixScenario(child.scenario);
        } else if (child.background != null) {
            fixBackground(child.background);
        }
    }
}

//////////////////////////////////////////////////
// 5 ADM Rules. Common functionality is moved to
// base classes.

// Base class containing helper methods used by all rules
class Rule {
    addScenario(index, statement, scenario) {
        if (index.get(statement) == null) {
            index.set(statement, []);
        }
        index.get(statement).push(scenario);
    }
}

// Common class for both attack & defense chaining rules
class Chain extends Rule {
    // Building edges is same for chaining... title of one appears in 'Given' of the rest.
    // It also needs scenarioType because chaining must be limited to same scenario types.
    BuildEdges(gherkinDoc, scenarioType) {
        let graphEdges = new Map();
        const ruleIndex = this.index(gherkinDoc, scenarioType, this.indexScenario);
        // iterate through map
        for (const [key, value] of ruleIndex) {
            // For chaining, there must be atleast 2 scenarios
            if (value.length < 2) {
                continue;
            }
            let source = null;
            let sinks = [];
            for (const scenario of value) {
                // Source is the scenario that has title same as key.
                if (scenario.name == key) {
                    source = scenario;
                } else {
                    sinks.push(scenario);
                }
            }
            // If source is not found, don't process
            if (source != null) {
                // map from this scenario to all other scenarios
                for (const sink of sinks) {
                    if (graphEdges.get(source) == null) {
                        graphEdges.set(source, []);
                    }
                    graphEdges.get(source).push(
                        {"rule": this.constructor.name,
                        "sink": sink
                    });
                }
            }
        }
        return graphEdges;
    }

    // Indexing is same for all chaining... go through each scenario of same 
    // type and each of its rules.
    //
    // NOTE: In case of attacks, this doesn't make sense. But that difference
    // is handled in indexRule() from super class (i.e., Rule).
    index(gherkinDoc, scenarioType) {
        let index = new Map();
        for (const child of gherkinDoc.feature.children) {
            if (child.scenario != null) {
                this.indexScenario(index, child.scenario, scenarioType);
            } else if (child.rule != null) {
                super.indexRule(index, child.rule, scenarioType, scenarioIndexFunc);
            }
        }
        return index;
    }

    indexScenario(index, scenario, scenarioType) {
        if (scenario.keyword != scenarioType) {
            return;
        }
        if (index[scenario.name] == null) {
            index.set(scenario.name, []);
        }
        super.addScenario(index, scenario.name, scenario);
        for (const step of scenario.steps) {
            if (step.keyword == 'Given') {
                super.addScenario(index, step.text, scenario);
            }
        }
    }

    indexRule(index, rule, scenarioType, scenarioIndexFunc) {
        for (const child of rule.children) {
            if (child.scenario != null) {
                // in ADM, Policy (i.e., rule) can only have defenses
                if (child.scenario.keyword != 'Defense') {
                    continue;
                }
                scenarioIndexFunc(index, child.scenario, scenarioType);
            }
        }
    }
}

class AttackChainRule extends Chain {
    BuildEdges(gherkinDoc) {
        return super.BuildEdges(gherkinDoc, 'Attack');
    }
}

class DefenseChainRule extends Chain {
    BuildEdges(gherkinDoc) {
        return super.BuildEdges(gherkinDoc, 'Defense');
    }
}

// Common class for all rules connecting attacks and defenses.
// Contains common functions used by all derived classes.
class AttacksAndDefenses extends Rule {
    // Indexing is same for all security controls... go through each scenario
    // and index it based on the type of rule being handled. This is handled 
    // by passed scenarioIndexFunc() from the child classes.
    index(gherkinDoc, scenarioIndexFunc) {
        let index = new Map();
        for (const child of gherkinDoc.feature.children) {
            if (child.scenario != null) {
                scenarioIndexFunc(index, child.scenario);
            } else if (child.rule != null) {
                this.indexRule(index, child.rule, scenarioIndexFunc);
            }
        }
        return index;
    }

    indexRule(index, rule, scenarioIndexFunc) {
        for (const child of rule.children) {
            if (child.scenario != null) {
                scenarioIndexFunc(index, child.scenario);
            }
        }
    }

    // Helper function to map sources to sinks
    mapSourcesToSinks(graphEdges, sources, sinks) {
        // If source is not found, don't process
        if (sources != null) {
            // an edge from each attack to each defense
            for (const source of sources) {
                for (const sink of sinks) {
                    if (graphEdges.get(source) == null) {
                        graphEdges.set(source, []);
                    }
                    graphEdges.get(source).push(
                        {"rule": this.constructor.name,
                        "sink": sink
                    });
                }
            }
        }
    }
}

// Base rule for both pre-emptive defense and incident response rules
class FromAttackToDefense extends AttacksAndDefenses {
    // Building edges is same for security controls... The only diffference is
    // the way two scenarios are matched, which is handled by scenarioIndexFunc.
    BuildEdges(gherkinDoc, scenarioIndexFunc) {
        let graphEdges = new Map();
        const ruleIndex = super.index(gherkinDoc, scenarioIndexFunc);
        // iterate through map
        for (const [key, value] of ruleIndex) {
            // For chaining, there must be atleast 2 scenarios
            if (value.length < 2) {
                continue;
            }
            let sources = [];
            let sinks = [];
            for (const scenario of value) {
                // All attacks are sources and all defenses are sinks
                if (scenario.keyword == 'Attack') {
                    sources.push(scenario);
                } else {
                    sinks.push(scenario);
                }
            }
            super.mapSourcesToSinks(graphEdges, sources, sinks);
        }
        return graphEdges;
    }
}

class PreEmptiveDefenseRule extends FromAttackToDefense {
    BuildEdges(gherkinDoc) {
        return super.BuildEdges(gherkinDoc, this.indexScenario);
    }

    indexScenario(index, scenario) {
        for (const step of scenario.steps) {
            // Index if it is an attack with a 'When' step
            // OR
            // Index if it is a defense with a 'When' step
            if (step.keyword == 'When') {
                super.addScenario(index, step.text, scenario);
            }
        }
    }
}

class IncidentResponseRule extends FromAttackToDefense {
    BuildEdges(gherkinDoc) {
        return super.BuildEdges(gherkinDoc, this.indexScenario);
    }

    indexScenario(index, scenario) {
        for (const step of scenario.steps) {
            // Index if it is an attack with a 'Then' step
            // OR
            // Index if it is a defense with a 'When' step
            if (
                (step.keyword == 'Then' && scenario.keyword == 'Attack') ||
                (step.keyword == 'When' && scenario.keyword == 'Defense')) {
                super.addScenario(index, step.text, scenario);
            }
        }
    }
}
class DefenseBreakerRule extends AttacksAndDefenses {
    BuildEdges(gherkinDoc) {
        let graphEdges = new Map();
        const ruleIndex = super.index(gherkinDoc, this.indexScenario);
        // iterate through map
        for (const [key, value] of ruleIndex) {
            // For chaining, there must be atleast 2 scenarios
            if (value.length < 2) {
                continue;
            }
            let sources = [];
            let sinks = [];
            for (const scenario of value) {
                // All defenses are sources and all attacks are sinks
                if (scenario.keyword == 'Defense') {
                    sources.push(scenario);
                } else {
                    sinks.push(scenario);
                }
            }
            super.mapSourcesToSinks(graphEdges, sources, sinks);
        }
        return graphEdges;
    }

    indexScenario(index, scenario) {
        for (const step of scenario.steps) {
            // Index if it is a defense with a 'Then' step
            // OR
            // Index if it is an attack with a 'When' step
            if (
                (step.keyword == 'Then' && scenario.keyword == 'Defense') ||
                (step.keyword == 'When' && scenario.keyword == 'Attack')) {
                super.addScenario(index, step.text, scenario);
            }
        }
    }
}
class TagBasedMatchingRule {
    BuildEdges(gherkinDoc) {
        let graph = new Map();
        // Build a map of tag to scenarios having the same tag
        let tagToScenarios = new Map();
        for (const child of gherkinDoc.feature.children) {
            if (child.scenario != null) {
                for (const tag of child.scenario.tags) {
                    if (tagToScenarios.get(tag.name) == null) {
                        tagToScenarios.set(tag.name, []);
                    }
                    tagToScenarios.get(tag.name).push(child.scenario);
                }
            } else if (child.rule != null) {
                for (const child of child.rule.children) {
                    if (child.scenario != null) {
                        for (const tag of child.scenario.tags) {
                            if (tagToScenarios.get(tag.name) == null) {
                                tagToScenarios.set(tag.name, []);
                            }
                            tagToScenarios.get(tag.name).push(child.scenario);
                        }
                    }
                }
            }
        }

        // For each tag, create edges from each attack to each defense
        for (const [key, value] of tagToScenarios) {
            let sources = [];
            let sinks = [];
            for (const scenario of value) {
                if (scenario.keyword == 'Attack') {
                    sources.push(scenario);
                } else if (scenario.keyword == 'Defense') {
                    sinks.push(scenario);
                }
            }
            for (const source of sources) {
                for (const sink of sinks) {
                    if (graph.get(source) == null) {
                        graph.set(source, []);
                    }
                    graph.get(source).push(
                        {"rule": this.constructor.name,
                        "sink": sink
                    });
                }
            }
        }

        return graph;
    }
}