// newId() - generates a random string for use as an ID.
function newId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Load() - accepts a string and outputs gherkinDocument object.
function Load(content, dialectName) {
    builder = new AstBuilder(newId);
    
    matcher = new GherkinClassicTokenMatcher(dialectName);
    parser = new Parser(builder, matcher);
    const gherkinDocument = parser.parse(content);
    return gherkinDocument;
}

// Match() - accepts gherkinDocument object and outputs a map of graph connections between gherkin objects.
function Match(gherkinDoc, rules) {
    let graphEdges = new Map();
    for (let rule of rules) {
        newMap = rule.BuildEdges(gherkinDoc);
        // Merge graphs. If source is present, merge sinks.
        for (const [key, value] of newMap) {
            if (graphEdges.has(key)) {
                graphEdges.get(key).push(...value);
            } else {
                graphEdges.set(key, value);
            }
        }
    }
    return graphEdges;
}
