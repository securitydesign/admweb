function GenerateGraphvizCode(graph, config) {
    unmitigatedAttacks = getUnMitigatedAttacks(graph);
    return generateDigraphCode("top", unmitigatedAttacks, graph, config);
}

//////////////////////////////////////////////
// Graphviz code builder functions

function generateNodeCode(id, label, properties) {
    return id + '[' +
    serializeProperty(createProperty('label', wrap(label), false)) + " " +
    serializeProperties(properties) + "];";
}

function generateDigraphCode(id, unmitigatedAttacks, graph, config) {
    var lines = []
    appendLine(lines, 0, 'digraph ' + id + ' {');
    appendLine(lines, 1, '// Base Styling');
    appendLine(lines, 1, 'compound=true;');
    appendLine(lines, 1, 'graph[' + serializeProperties(config.Graph) + '];');
    appendLine(lines, 1, 'edge[arrowhead="empty"];');
    appendLineSpacer(lines);
    appendLine(lines, 1, '// Start and end nodes');
    appendLine(lines, 1, generateNodeCode('reality', 'Reality', config.Reality));
    if (unmitigatedAttacks.length > 0) {
        appendLine(lines, 1, generateNodeCode('attacker_wins', 'ATTACKER WINS!', config.AttackerWins));
    }

    [initNodes, results] = generateModelGraphCode(graph);
    lines = lines.concat(results);

    for (preCondition of initNodes) {
        appendLine(lines, 1, 'reality -> ' + preCondition);
    }

    // connect unmitigated attacks to attacker wins node
    for (attack of unmitigatedAttacks) {
        appendLine(lines, 1, generateID(attack.label) + ' -> attacker_wins [penwidth="4" color="red"];');
    }
    lines = lines.concat("}");

    return lines;
}

function generateModelGraphCode(graph) {
    var lines = [];
    appendLine(lines, 1, 'subgraph cluster_' + generateID(graph.name) + ' {');
    appendLine(lines, 2, serializeProperty(createProperty('label', '<<B>' + htmlwrap(graph.name) + '</B>>;', true)));
    appendLine(lines, 2, 'graph[' + serializeProperties(graph.properties) + '];');

    for ([nodeName, node] of graph.nodes) {
        appendLine(lines, 2, generateNodeCode(node.id, node.label, node.properties));
    }

    var allAssumptions = [];

    for (subgraph of graph.subgraphs) {
        if (subgraph.getProperty('type') == 'Assumption') {
            allAssumptions.push(subgraph);
        }

        lines = lines.concat(generateSubGraph(subgraph));
    }

    // create edges from each assumption subgraph to each attack/defense node in this graph
    for (assumption of allAssumptions) {
        firstNode = assumption.nodes.values().next().value;
        for (node of graph.nodes.values()) {
            if (node.getProperty('type') == 'Attack' || node.getProperty('type') == 'PreEmptiveDefense' || node.getProperty('type') == 'IncidentResponse') {
                appendLine(lines, 2, generateID(firstNode.id) + ' -> ' + node.id + '[ltail=cluster_' + assumption.id + '];');
            }
        }
    }


    for (edge of graph.edges) {
        appendLine(lines, 2, generateID(edge.source) + ' -> ' + generateID(edge.sink) + ';');
    }

    // InitNodes are nodes that are not sinks of any edge
    var initNodeIDs = []
    for ([nodeName, node] of graph.nodes) {
        var connected = false;
        for (edge of graph.edges) {
            if (edge.sink == node.label) {
                connected = true;
                break;
            }
        }
        if (!connected) {
            initNodeIDs.push(node.id);
        }
    }

    // All assumptions and init nodes have same rank in the graph
    rankLine = '{rank=same;';
    for (nodeID of initNodeIDs) {
        rankLine += nodeID + ';';
    }
    rankLine += '}';
    appendLine(lines, 2, rankLine);

    appendLine(lines, 1, '}');

    return [initNodeIDs, lines];
}

function generateSubGraph(subgraph) {
    var lines = [];
    appendLine(lines, 2, 'subgraph cluster_' + subgraph.id + ' {');
    appendLine(lines, 3, serializeProperty(createProperty('label', '<<B>' + htmlwrap(subgraph.name) + '</B>>;', true)));
    appendLine(lines, 3, 'graph[' + serializeProperties(subgraph.properties) + '];');
    
    for ([nodeName, node] of subgraph.nodes) {
        appendLine(lines, 2, generateNodeCode(node.id, node.label, node.properties));
    }

    var allAssumptions = [];
    for (s of subgraph.subgraphs) {
        if (s.getProperty('type') == 'Assumption') {
            allAssumptions.push(s);
        }
        lines = lines.concat(generateSubGraph(s));
    }

    // create edges from each assumption subgraph to each attack/defense node in this graph
    for (assumption of allAssumptions) {
        firstNode = assumption.nodes.values().next().value;
        for (node of subgraph.nodes.values()) {
            if (node.getProperty('type') == 'Attack' || node.getProperty('type') == 'PreEmptiveDefense' || node.getProperty('type') == 'IncidentResponse') {
                appendLine(lines, 2, generateID(firstNode.id) + ' -> ' + node.id + '[ltail=cluster_' + assumption.id + '];');
            }
        }
    }

    for (edge of subgraph.edges) {
        appendLine(lines, 2, generateID(edge.source) + ' -> ' + generateID(edge.sink) + ';');
    }
    
    appendLine(lines, 2, '}');

    return lines;
}


function generateLegend() {
    legend = []
    /*appendLineSpacer(legend);
    appendLine(legend, 1, 'subgraph cluster_legend {');
    appendLine(legend, 2, 'label="Legend";');
    appendLine(legend, 2, 'graph[style="filled, rounded" rankdir="LR" fontsize="16" splines="true" overlap="false" nodesep="0.1" ranksep="0.2" fontname="Courier" fillcolor="lightyellow" color="yellow"];');
    appendLineSpacer(legend);
    appendLine(legend, 2, '// Legend Nodes');
    appendLine(legend, 2, 'A[label="Pre-\\nCondition" shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="black" fillcolor="lightgray" color="gray"];');
    appendLine(legend, 2, 'B[label="Assumptions" shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="white" fillcolor="dimgray" color="dimgray"];');
    appendLine(legend, 2, 'C[label="Attack" shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="white" fillcolor="red" color="red"];');
    appendLine(legend, 2, 'D[label="Pre-emptive\\nDefense"  shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="white" fillcolor="purple" color="blue"];');
    appendLine(legend, 2, 'E[label="Incident\\nResponse"  shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="white" fillcolor="blue" color="blue"];');
    appendLine(legend, 2, 'F[label="Policy" shape="box" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="black" fillcolor="darkolivegreen3" color="darkolivegreen3"];');
    appendLine(legend, 2, 'G[label="Empty\\nDefense" shape="box3d" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="black" fillcolor="transparent" color="blue"];');
    appendLine(legend, 2, 'H[label="Empty\\nAttack" shape="box3d" style="filled,rounded" margin="0.2" fontname="Arial" fontsize="12" fontcolor="black" fillcolor="transparent" color="red"];');
    appendLine(legend, 1, '}');
    appendLine(legend, 1, 'A -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(legend, 1, 'B -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(legend, 1, 'C -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(legend, 1, 'D -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(legend, 1, 'E -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(legend, 1, 'F -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(legend, 1, 'G -> reality [style="invis" ltail="cluster_Legend"];');
    appendLine(legend, 1, 'H -> reality [style="invis" ltail="cluster_Legend"];');
    */
    return legend;
}

//////////////////////////////////////////////
// Functions that work on Graph objects

function getUnMitigatedAttacks(graph) {
    var unMitigatedAttacks = []
    for ([nodeName, node] of graph.nodes) {
        if (node.getProperty('type') != 'Attack' && node.getProperty('type') != 'EmptyAttack') {
            continue;
        }
        var mitigated = false;
        for (edge of graph.edges) {
            if (edge.source == node.label) {
                var sink = graph.nodes.get(edge.sink);
                if (sink == undefined) {
                    // look into policy subgraphs
                    for (subgraph of graph.subgraphs) {
                        sink = subgraph.nodes.get(edge.sink);
                        if (sink != undefined) {
                            break;
                        }
                    }
                }
                if (sink.getProperty('type') == 'PreEmptiveDefense' || 
                    sink.getProperty('type') == 'IncidentResponse') {
                    // attack is mitigated
                    mitigated = true;
                    break;
                }
            }
        }
        if (!mitigated) {
            unMitigatedAttacks.push(node);
        }
    }

    return unMitigatedAttacks;
}

//////////////////////////////////////////////
// Helper functions

function serializeProperties(properties) {
    var serialized = "";
    for (property of properties) {
        serialized += " " + serializeProperty(property);
    }
    return serialized.trim();
}

function serializeProperty(property) {
    var str = "";
    if (property.isHTML) {
        str += property.name + "=" + property.value;
    } else {
        str += property.name + "=\"" + property.value + "\"";
    }
    return str;
}

function appendLine(lines, tabs, line) {
    lines.push(generateTabs(tabs) + line);
}

function appendLineSpacer(lines) {
    lines.push("");
}

function generateTabs(count) {
    var tabs = '';
    for (var i = 0; i < count; i++) {
        tabs += '\t';
    }
    return tabs;
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