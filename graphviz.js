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

    [initNodes, results] = generateModelGraphCode(graph, unmitigatedAttacks);
    lines = lines.concat(results);

    for (preCondition of initNodes) {
        appendLine(lines, 1, 'reality -> ' + preCondition);
    }

    lines = lines.concat("}");

    return lines;
}

function generateModelGraphCode(graph, unmitigatedAttacks) {
    var lines = [];
    appendLine(lines, 1, 'subgraph cluster_' + generateID(graph.name) + ' {');
    allAssumptions = [];
    for (subgraph of graph.subgraphs) {
        if (subgraph.getProperty('type') == 'Assumption') {
            for (node of subgraph.nodes.values()) {
                allAssumptions.push(node.label);
            }
        }
    }
    labelLines = [];
    appendLine(labelLines, 0, "<TABLE BORDER=\"0\" CELLBORDER=\"0\" CELLSPACING=\"0\">");
    appendLine(labelLines, 3, "<TR><TD><FONT POINT-SIZE=\"24\"><B>" + htmlwrap(graph.name) + "</B></FONT></TD></TR>");
    appendLine(labelLines, 3, "<TR><TD></TD></TR>");
    if (allAssumptions.length > 0) {
        appendLine(labelLines, 3, "<TR><TD><FONT POINT-SIZE=\"14\" COLOR=\"brown\"><B>Assumptions</B></FONT></TD></TR>");
        appendLine(labelLines, 3, "<TR><TD BORDER=\"1\" SIDES=\"T\"></TD></TR>");
        for (assumption of allAssumptions) {
            appendLine(labelLines, 3, "<TR><TD ALIGN=\"LEFT\"><FONT POINT-SIZE=\"14\" COLOR=\"brown\">• " + assumption + "</FONT></TD></TR>")
        }
        appendLine(labelLines, 3, "<TR><TD BORDER=\"1\" SIDES=\"T\"><BR/></TD></TR>");
    }
    appendLine(labelLines, 2, "</TABLE>")
    appendLine(lines, 2, serializeProperty(createProperty('label', '<' + labelLines.join('\n') + '>;', true)));
    appendLine(lines, 2, 'graph[' + serializeProperties(graph.properties) + '];');

    unmitigatedAttackProperties = (new GraphvizConfig()).UnmitigatedAttack;

    for ([nodeName, node] of graph.nodes) {
        if (node.getProperty('type') == 'Attack') {
            found = false;
            for (attack of unmitigatedAttacks) {
                if (attack.label == node.label) {
                    found = true;
                    break;
                }
            }
            if (found) {
                appendLine(lines, 2, generateNodeCode(node.id, node.label, unmitigatedAttackProperties));
            } else {
                appendLine(lines, 2, generateNodeCode(node.id, node.label, node.properties));
            }
        } else {
            appendLine(lines, 2, generateNodeCode(node.id, node.label, node.properties));
        }
    }

    //var allAssumptions = [];

    for (subgraph of graph.subgraphs) {
        if (subgraph.getProperty('type') != 'Assumption') {
            lines = lines.concat(generateSubGraph(subgraph));
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
    allAssumptions = [];
    for (s of subgraph.subgraphs) {
        if (s.getProperty('type') == 'Assumption') {
            for (node of s.nodes.values()) {
                allAssumptions.push(node.label);
            }
        }
    }
    labelLines = [];
    appendLine(labelLines, 0, "<TABLE BORDER=\"0\" CELLBORDER=\"0\" CELLSPACING=\"0\">");
    appendLine(labelLines, 3, "<TR><TD><FONT POINT-SIZE=\"18\"><B>" + htmlwrap(subgraph.name) + "</B></FONT></TD></TR>");
    appendLine(labelLines, 3, "<TR><TD></TD></TR>");
    if (allAssumptions.length > 0) {
        appendLine(labelLines, 3, "<TR><TD><FONT POINT-SIZE=\"14\" COLOR=\"brown\"><B>Assumptions</B></FONT></TD></TR>");
        appendLine(labelLines, 3, "<TR><TD BORDER=\"1\" SIDES=\"T\" COLOR=\"WHITE\"></TD></TR>");
        for (assumption of allAssumptions) {
            appendLine(labelLines, 3, "<TR><TD ALIGN=\"LEFT\"><FONT POINT-SIZE=\"14\" COLOR=\"brown\">• " + assumption + "</FONT></TD></TR>")
        }
        appendLine(labelLines, 3, "<TR><TD BORDER=\"1\" SIDES=\"T\" COLOR=\"WHITE\"><BR/></TD></TR>");
    }
    appendLine(labelLines, 2, "</TABLE>")
    appendLine(lines, 2, serializeProperty(createProperty('label', '<' + labelLines.join('\n') + '>;', true)));
    appendLine(lines, 3, 'graph[' + serializeProperties(subgraph.properties) + '];');
    
    for ([nodeName, node] of subgraph.nodes) {
        appendLine(lines, 2, generateNodeCode(node.id, node.label, node.properties));
    }

    //var allAssumptions = [];
    for (s of subgraph.subgraphs) {
        if (s.getProperty('type') != 'Assumption') {
            lines = lines.concat(generateSubGraph(s));
        }
    }

    for (edge of subgraph.edges) {
        appendLine(lines, 2, generateID(edge.source) + ' -> ' + generateID(edge.sink) + ';');
    }
    
    appendLine(lines, 2, '}');

    return lines;
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