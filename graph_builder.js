function CreateGraph(gherkinDocument, edgesMap, config) {
    var graph = new Graph(gherkinDocument.feature.name, config.Graph);

    // Process each 'Attack' and 'Defense' scenario
    for (child of gherkinDocument.feature.children) {
        if (child.scenario) {
            if (child.scenario.keyword == "Attack") {
                addAttack(graph, child.scenario, config);
                addFreeAttackPreconditions(graph, child.scenario, edgesMap, config);
            } else if (child.scenario.keyword == "Defense") {
                addDefense(graph, child.scenario, edgesMap, config);
                addFreeDefensePreconditions(graph, child.scenario, edgesMap, config);
            }
        } else if (child.background) {
            graph.addSubgraph(createAssumptionSubgraph(child.background, config));
        } else if (child.rule) {
            graph.addSubgraph(createPolicySubgraph(child.rule, edgesMap, config));
        }
    }

    // Add edges from edgesMap
    addEdges(graph, edgesMap);
    
    return graph;
}

//////////////////////////////////////////////
// builder functions

// No processing required to add attacks
function addAttack(graph, attack, config) {
    var node = new Node(attack.name, config.Attack);
    graph.addNode(node);
}

// Add all attack preconditions that are not part of a chain
function addFreeAttackPreconditions(graph, attack, edgesMap, config) {
    // iterate through all edges, pick sinks from each attack chain,
    // and extract the 'Given' statement that matched.
    var allMatched = [];
    for ([source, sinks] of edgesMap) {
        for (sink of sinks) {
            if (sink["sink"] == attack && sink["rule"] == "AttackChainRule") {
                allMatched.push(sink["matched"]);
            }
        }
    }

    // pull preconditions that are not part of 'allMatched'
    // and convert them into precondition nodes
    for (step of attack.steps) {
        if (step.keyword == "Given" && allMatched.indexOf(step.text) == -1) {
            var node = new Node(step.text, config.PreConditions);
            graph.addNode(node);
            graph.addEdge(new Edge(step.text, attack.name, []));
        }
    }
}

// Look at the edgesMap to determine the type of defense
// and add accordingly
function addDefense(graph, defense, edgesMap, config) {
    // if defense node has title only
    if (defense.steps.length == 0) {
        var node = new Node(defense.name, config.EmptyDefense);
        graph.addNode(node);
        return;
    }
    // Defense node properties are based on the rule it matches with
    for ([source, sinks] of edgesMap) {
        for (sink of sinks) {
            if (sink["sink"] == defense) {
                if (sink["rule"] == "DefenseChainRule" || sink["rule"] == "PreEmptiveDefenseRule" || sink["rule"] == "TagBasedMatchingRule") {
                    var node = new Node(defense.name, config.PreEmptiveDefense);
                    graph.addNode(node);
                    return;
                } else if (sink["rule"] == "IncidentResponseRule") {
                    var node = new Node(defense.name, config.IncidentResponse);
                    graph.addNode(node);
                    return;
                }
            }
        }            
    }
    
    // otherwise it is a defense with no attack to mitigate. We assume it to be incident response.
    var node = new Node(defense.name, config.IncidentResponse);
    graph.addNode(node);
    return;
}

function addFreeDefensePreconditions(graph, defense, edgesMap, config) {
    // iterate through all edges, pick sinks from each defense chain,
    // and extract the 'Given' statement that matched.
    var allMatched = [];
    for ([source, sinks] of edgesMap) {
        for (sink of sinks) {
            if (sink["sink"] == defense && sink["rule"] == "DefenseChainRule") {
                allMatched.push(sink["matched"]);
            }
        }
    }

    // pull preconditions that are not part of 'allMatched'
    // and convert them into precondition nodes
    for (step of defense.steps) {
        if (step.keyword == "Given" && allMatched.indexOf(step.text) == -1) {
            var node = new Node(step.text, config.PreConditions);
            graph.addNode(node);
            graph.addEdge(new Edge(step.text, defense.name, []));
        }
    }
}

function createAssumptionSubgraph(assumption, config) {
    var properties = [];
    properties = properties.concat(createProperty('label', '<<B>' + htmlwrap(assumption.name) + '</B>>;', true));
    properties = properties.concat(config.Assumption);

    var graph = new Graph(assumption.name, properties);

    for (step of child.background.steps) {
        var node = new Node(step.text, config.PreConditions);
        graph.addNode(node);
    }

    return graph;
}

function createPolicySubgraph(policy, edgesMap, config) {
    var properties = [];
    properties = properties.concat(createProperty('label', '<<B>' + htmlwrap(policy.name) + '</B>>;', true));
    properties = properties.concat(config.Policy);
    var graph = new Graph(policy.name, properties);

    for (child of policy.children) {
        if (child.scenario) {
            addDefense(graph, child.scenario, edgesMap, config);
            addFreeDefensePreconditions(graph, child.scenario, edgesMap, config);
        } else if (child.background) {
            graph.addSubgraph(createAssumptionSubgraph(child.background, config));
        }
    }

    return graph;
}

function addEdges(graph, edgesMap) {
    for ([source, sinks] of edgesMap) {
        for (sink of sinks) {
            graph.addEdge(new Edge(source.name, sink["sink"].name, []));
        }
    }
}