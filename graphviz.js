
// GraphvizConfig structure to hold properties for each type of node and edge
const ShapeOptions = {
    BOX: 'box',
    BOX3D: 'box3d',
}

function createProperty(name, value, hasHTML) {
    if (hasHTML) {
        return name + "=" + value + " ";
    } else {
        return name + "=\"" + value + "\" ";
    }
}

function ColorSet(fontcolor, fillcolor, bordercolor) {
    return createProperty("fontcolor", fontcolor, false) +
        createProperty("fillcolor", fillcolor, false) +
        createProperty("color", bordercolor, false);
}

function TextProperties(fontname, fontsize) {
    return createProperty("fontname", fontname, false) +
        createProperty("fontsize", fontsize, false);
}

function NodeProperties(fontname, fontsize, fontcolor, fillcolor, bordercolor) {
    return createProperty("style", "filled, rounded", false) +
        TextProperties(fontname, fontsize) +
        ColorSet(fontcolor, fillcolor, bordercolor) +
        "];\n";
}

function GraphvizConfig() {
    this.Assumption = createProperty('shape', ShapeOptions.BOX, false) + NodeProperties('Times', 18, 'white', 'dimgray', 'dimgray');
    this.Policy = createProperty('shape', ShapeOptions.BOX, false) + NodeProperties('Times', 18, 'black', 'darkolivegreen3', 'darkolivegreen3');
    this.PreConditions = createProperty('shape', ShapeOptions.BOX, false) + NodeProperties('Arial', 16, 'black', 'lightgray', 'gray');
    this.Attack = createProperty('shape', ShapeOptions.BOX, false) + NodeProperties('Arial', 16, 'white', 'red', 'red');
    this.PreEmptiveDefense = createProperty('shape', ShapeOptions.BOX, false) + NodeProperties('Arial', 16, 'white', 'purple', 'blue');
    this.IncidentResponse = createProperty('shape', ShapeOptions.BOX, false) + NodeProperties('Arial', 16, 'white', 'blue', 'blue');
    this.EmptyDefense = createProperty('shape', ShapeOptions.BOX3D, false) + NodeProperties('Arial', 16, 'black', 'transparent', 'blue');
    this.EmptyAttack = createProperty('shape', ShapeOptions.BOX3D, false) + NodeProperties('Arial', 16, 'black', 'transparent', 'red');
    this.Reality = createProperty('shape', ShapeOptions.BOX, false) + NodeProperties('Arial', 20, 'white', 'black', 'black');
    this.AttackerWins = createProperty('shape', ShapeOptions.BOX, false) + NodeProperties('Arial', 20, 'red', 'yellow', 'yellow');
}

function generateNode(id, label, properties) {
    return id + '[' +
    createProperty('label', label, false) +
    properties;
}

function generateHeader(id, includeAttackerWins, realityProperties, attackerWinsProperties) {
    header = []
    appendLine(header, 0, 'digraph ' + id + ' {');
    appendLine(header, 1, '// Base Styling');
    appendLine(header, 1, 'compound=true;');
    appendLine(header, 1, 'graph[style="filled, rounded" rankdir="LR" splines="true" overlap="false" nodesep="0.2" ranksep="0.9"];');
    appendLineSpacer(header);
    appendLine(header, 1, '// Start and end nodes');
    appendLine(header, 1, generateNode('reality', 'Reality', realityProperties));
    if (includeAttackerWins) {
        appendLine(header, 1, generateNode('attacker_wins', 'ATTACKER WINS!', attackerWinsProperties));
    }

    return header;
}

function generateBody(gherkinDocument, unmitigatedAttacks, edgesMap, config) {
    body = [];
    body = generateModelSubGraph(gherkinDocument, edgesMap, config);
    // connect unmitigated attacks to attacker wins node
    for (attack of unmitigatedAttacks) {
        appendLine(body, 1, generateID(attack.name) + ' -> attacker_wins;');
    }
    return body;
}

function generateFooter(lines) {
    footer = []
    /*appendLineSpacer(footer);
    appendLine(footer, 1, 'subgraph cluster_legend {');
    appendLine(footer, 2, 'label="Legend";');
    appendLine(footer, 2, 'graph[style="filled, rounded" rankdir="LR" fontsize="16" splines="true" overlap="false" nodesep="0.1" ranksep="0.2" fontname="Courier" fillcolor="lightyellow" color="yellow"];');
    appendLineSpacer(footer);
    appendLine(footer, 2, '// Legend Nodes');
    appendLine(footer, 2, 'A[label="Pre-\\nCondition" shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="black" fillcolor="lightgray" color="gray"];');
    appendLine(footer, 2, 'B[label="Assumptions" shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="white" fillcolor="dimgray" color="dimgray"];');
    appendLine(footer, 2, 'C[label="Attack" shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="white" fillcolor="red" color="red"];');
    appendLine(footer, 2, 'D[label="Pre-emptive\\nDefense"  shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="white" fillcolor="purple" color="blue"];');
    appendLine(footer, 2, 'E[label="Incident\\nResponse"  shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="white" fillcolor="blue" color="blue"];');
    appendLine(footer, 2, 'F[label="Policy" shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="black" fillcolor="darkolivegreen3" color="darkolivegreen3"];');
    appendLine(footer, 2, 'G[label="Empty\\nDefense" shape="box3d" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="black" fillcolor="transparent" color="blue"];');
    appendLine(footer, 2, 'H[label="Empty\\nAttack" shape="box3d" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="black" fillcolor="transparent" color="red"];');
    appendLine(footer, 1, '}');
    appendLine(footer, 1, 'A -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(footer, 1, 'B -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(footer, 1, 'C -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(footer, 1, 'D -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(footer, 1, 'E -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(footer, 1, 'F -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(footer, 1, 'G -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(footer, 1, 'H -> reality [style="invis" ltail="cluster_Legend"];');
    */
    return footer;
}

function getAttackerWinsPredecessors(gherkinDocument, edgesMap) {
}

function CreateGraphvizGraph(gherkinDocument, edgesMap) {
    //awp = getAttackerWinsPredecessors(gherkinDocument, edgesMap);
    var lines = [];
    var config = new GraphvizConfig();
    // collect all attack scenarios
    var attackScenarios = [];
    for (child of gherkinDocument.feature.children) {
        if (child.scenario && child.scenario.keyword == "Attack") {
            attackScenarios.push(child.scenario);
        }
    }
    
    var unmitigatedAttacks = [];
    // collect attacks that don't have a defense (pre-emptive or incident response) as sink
    for (attack of attackScenarios) {
        var mitigated = false;
        for ([source, sinks] of edgesMap) {
            if (source != attack) {
                continue;
            }
            for (sink of sinks) {
                if (sink["sink"].keyword == "Defense" && (sink["rule"] == "PreEmptiveDefenseRule" || sink["rule"] == "IncidentResponseRule")) {
                    mitigated = true;
                }
            }
        }
        if (!mitigated) {
            unmitigatedAttacks.push(attack);
        }
    }
    
    // append all strings from generateHeader string array to lines array
    lines = lines.concat(generateHeader("top", unmitigatedAttacks.length > 0, config.Reality, config.AttackerWins));
    lines = lines.concat(generateBody(gherkinDocument, unmitigatedAttacks, edgesMap, config));
    lines = lines.concat(generateFooter());
    lines = lines.concat("}");

    return lines;
}

//////////////////////////////////////////////
// ADM graph generator functions

function generateModelSubGraph(gherkinDocument, edgesMap, config) {
    lines = [];
    modelProperties = NodeProperties('Arial', 24, 'black', 'transparent', 'gray');
    appendLine(lines, 1, 'subgraph cluster_' + generateID(gherkinDocument.feature.name) + ' {');
    appendLine(lines, 2, createProperty('label', '<<B>' + htmlwrap(gherkinDocument.feature.name) + '</B>>;', true));
    appendLine(lines, 2, 'graph[style="filled,rounded" rankdir="LR" splines="true" overlap="false" nodesep="0.2" ranksep="0.9" fontname="Arial"  fontsize="24"  fontcolor="black"  fillcolor="transparent"  color="gray" ];');
    preConditions = collectFreePreConditions(gherkinDocument, edgesMap, config);
    lines = lines.concat(generatePreconditionNodes(preConditions, config));
    for (child of gherkinDocument.feature.children) {
        if (child.scenario) {
            appendLine(lines, 2, generateScenarioNode(child.scenario, edgesMap, config));
        }
    }
    appendLine(lines, 1, '}');
    lines = lines.concat(connectRealityToPreConditions(preConditions));
    lines = lines.concat(connectRealityToInitialNodes(gherkinDocument, edgesMap, config));
    lines = lines.concat(connectPreConditionsToScenarios(preConditions, collectScenarios(gherkinDocument)));
    
    lines = lines.concat(connectScenarios(edgesMap));
    return lines;
}

function generateAssumptionSubGraph(gherkinDocument, edgesMap, config) {
}

function generateScenarioNode(scenario, edgesMap, config) {
    if (scenario.keyword == "Attack") {
        return generateID(scenario.name) + '[' + createProperty("label", wrap(scenario.name), false) + config.Attack;
    } else if (scenario.keyword == "Defense") {
        // check if defense is a pre-emptive defense
        for ([source, sinks] of edgesMap) {
            for (sink of sinks) {
                if (sink["sink"] == scenario) {
                    if (sink["rule"] == "PreEmptiveDefenseRule") {
                        return generateID(scenario.name) + '[' + createProperty("label", wrap(scenario.name), false) + config.PreEmptiveDefense;
                    } else if (sink["rule"] == "IncidentResponseRule") {
                        return generateID(scenario.name) + '[' + createProperty("label", wrap(scenario.name), false) + config.IncidentResponse;
                    }
                }
            }            
        }
        // otherwise it is an empty defense (assumed to be incident response)
        return generateID(scenario.name) + '[' + createProperty("label", wrap(scenario.name), false) + config.IncidentResponse;
    }
}

// extract preconditions that are not part of connecting attacks or defenses
function generatePreconditionNodes(preConditions, config) {
    var lines = [];
    
    // generate nodes for free preconditions
    for (preCondition of preConditions) {
        appendLine(lines, 2, generateID(preCondition) + '[' + createProperty("label", wrap(preCondition), false) + config.PreConditions);
    }

    return lines;
}

function collectScenarios(gherkinDocument) {
    var scenarios = [];
    for (child of gherkinDocument.feature.children) {
        if (child.scenario) {
            scenarios.push(child.scenario);
        }
    }
    return scenarios;

}

function collectFreePreConditions(gherkinDocument, edgesMap) {
    var preConditions = [];
    scenarios = collectScenarios(gherkinDocument);
    // remove scenarios that are sinks when participating in a chain (attack or defense)
    for (child of gherkinDocument.feature.children) {
        if (child.scenario) {
            for ([source, sinks] of edgesMap) {
                for (sink of sinks) {
                    if (sink["sink"] == child.scenario && (sink["rule"] == "AttackChainRule" || sink["rule"] == "DefenseChainRule")) {
                        var index = scenarios.indexOf(child.scenario);
                        if (index > -1) {
                            scenarios.splice(index, 1);
                        }
                    }
                }
            }
        }
    }
    // For the remaining scenarios, extract preconditions
    preConditions = [];
    for (scenario of scenarios) {
        for (step of scenario.steps) {
            if (step.keyword == "Given") {
                if (preConditions.indexOf(step.text) == -1) {
                    preConditions.push(step.text);   
                }
            }
        }
    }
    return preConditions;
}

function connectRealityToPreConditions(preConditions) {
    var lines = [];
    for (preCondition of preConditions) {
        appendLine(lines, 1, 'reality -> ' + generateID(preCondition) + ';');
    }
    return lines;
}

// Connect attacks/defenses to reality that don't have a predecessor
function connectRealityToInitialNodes(gherkinDocument, edgesMap, config) {
    var lines = [];
    for (child of gherkinDocument.feature.children) {
        if (child.scenario) {
            var hasPredecessor = false;
            for ([source, sinks] of edgesMap) {
                for (sink of sinks) {
                    if (sink["sink"] == child.scenario) {
                        hasPredecessor = true;
                    }
                }
            }
            if (!hasPredecessor) {
                appendLine(lines, 1, 'reality -> ' + generateID(child.scenario.name) + ';');
            }
        }
    }
    return lines;
}

function connectPreConditionsToScenarios(preConditions, scenarios) {
    var lines = [];
    for (preCondition of preConditions) {
        for (scenario of scenarios) {
            for (step of scenario.steps) {
                if (step.keyword == "Given" && step.text == preCondition) {
                    appendLine(lines, 1, generateID(preCondition) + ' -> ' + generateID(scenario.name) + ';');
                }
            }
        }
    }
    return lines;
}

function connectScenarios(edgesMap) {
    var lines = [];
    for ([source, sinks] of edgesMap) {
        for (sink of sinks) {
            appendLine(lines, 1, generateID(source.name) + ' -> ' + generateID(sink["sink"].name) + ';');
        }
    }
    return lines;
}

//////////////////////////////////////////////
// Helper functions

function appendLine(lines, tabs, line) {
    lines.push(generateTabs(tabs) + line);
}

function appendLineSpacer(lines) {
    lines.push("");
}

function cleanup(str) {
    // replace ".", "(", ")", "[", "]", "{", "}", "'", "`", "-", "+", "?", ",", ":" with ""
    str = str.replace(/[.()\[\]{}'`\-+?,]/g, "");

    // replace specific symbols with their alternates
    replacements = new Map();
    replacements.set("<", "_lt_");
    replacements.set(">", "_gt_");
    replacements.set("=",  "_eq_");
    replacements.set("\"", "_quot_");
    replacements.set("/", "_slash_");
    for (var [key, value] of replacements) {
        str = str.replace(key, value);
    }

    return str;
}

function generateTabs(count) {
    var tabs = '';
    for (var i = 0; i < count; i++) {
        tabs += '\t';
    }
    return tabs;
}

function generateID(text) {
    text = cleanup(text);
    var id = text.replace(/\s/g, '_');
    return id;
}

// Break text into multiple lines by adding '\n' at word boundary with maximum length of 15 characters
function wrap(text) {
    var words = text.split(' ');
    wrappedString = "";
    length = 0;
    for (var i = 0; i < words.length; i++) {
        length += words[i].length;
        if (length > 15) {
            wrappedString += '\\n' + words[i];
            length = 0;
        } else {
            wrappedString += ' ' + words[i];
        }
    }

    return wrappedString.trim();
}

// Break text into multiple lines by adding '<br></br>' at word boundary with maximum length of 15 characters
function htmlwrap(text) {
    var words = text.split(' ');
    wrappedString = "";
    length = 0;
    for (var i = 0; i < words.length; i++) {
        length += words[i].length;
        if (length > 15) {
            wrappedString += '<br></br>' + words[i];
            length = 0;
        } else {
            wrappedString += ' ' + words[i];
            length += words[i].length;
        }
    }

    return wrappedString.trim();
}