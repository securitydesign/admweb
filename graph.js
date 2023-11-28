class Property {
    constructor(name, value, isHTML) {
        this.name = name;
        this.value = value;
        this.isHTML = isHTML;
    }
}

class Node {
    constructor(name, properties) {
        this.id = generateID(name);
        this.label = name;
        this.properties = [];
        this.properties = this.properties.concat(properties);
    }

    addProperty(property) {
        this.properties.push(property);
    }

    getProperty(name) {
        for (var property of this.properties) {
            if (property.name == name) {
                return property.value;
            }
        }
    }
}

class Edge {
    constructor(source_node, sink_node, properties) {
        this.source = source_node;
        this.sink = sink_node;
        this.properties = properties;
    }
    addProperty(property) {
        this.properties.push(property);
    }

    getProperty(name) {
        for (var property of this.properties) {
            if (property.name == name) {
                return property.value;
            }
        }
    }
}

class Graph {
    constructor(name, properties) {
        this.id = generateID(name);
        this.name = name;
        this.properties = properties;
        
        this.nodes = new Map();
        this.edges = [];
        this.subgraphs = [];
    }

    addProperty(property) {
        this.properties.push(property);
    }

    getProperty(name) {
        for (var property of this.properties) {
            if (property.name == name) {
                return property.value;
            }
        }
    }

    addNode(node) {
        if (!this.nodes.has(node.label)) {
            this.nodes.set(node.label, node);
        } else {
            console.error("Node '" + node.label + "' already exists in graph '" + this.name + "'");
        }
    }

    addEdge(edge) {
        this.edges.push(edge);
    }

    addSubgraph(subgraph) {
        this.subgraphs.push(subgraph);
    }
}

//////////////////////////////////////////////
// Helper functions

function generateID(text) {
    text = this.cleanup(text);
    var id = text.replace(/\s/g, '_');
    return id;
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
        // replace all instances of key with value
        str = str.replace(new RegExp(key, 'g'), value);
    }

    return str;
}