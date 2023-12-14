const ShapeOptions = {
    BOX: 'box',
    BOX3D: 'box3d',
}

function createProperty(name, value, hasHTML) {
    return new Property(name, value, hasHTML);
}

function ColorSet(fontcolor, fillcolor, bordercolor) {
    properties = [];

    properties = properties.concat(createProperty("fontcolor", fontcolor, false));
    properties = properties.concat(createProperty("fillcolor", fillcolor, false));
    properties = properties.concat(createProperty("color", bordercolor, false));
    
    return properties;
}

function TextProperties(fontname, fontsize) {
    properties = [];

    properties = properties.concat(createProperty("fontname", fontname, false));
    properties = properties.concat(createProperty("fontsize", fontsize, false));

    return properties;
}

function NodeProperties(style, fontname, fontsize, fontcolor, fillcolor, bordercolor, borderthickness = 1) {
    properties = [];
    
    properties = properties.concat(createProperty("style", style, false));
    properties = properties.concat(TextProperties(fontname, fontsize));
    properties = properties.concat(ColorSet(fontcolor, fillcolor, bordercolor));
    properties = properties.concat(createProperty("penwidth", borderthickness, false));

    return properties;
}

function GraphvizConfig() {
    this.Graph = [];
    this.Graph = this.Graph.concat(createProperty('style', 'filled,rounded', false));
    this.Graph = this.Graph.concat(createProperty('rankdir', 'LR', false));
    this.Graph = this.Graph.concat(createProperty('splines', 'true', false));
    this.Graph = this.Graph.concat(createProperty('overlap', 'false', false));
    this.Graph = this.Graph.concat(createProperty('nodesep', '0.2', false));
    this.Graph = this.Graph.concat(createProperty('ranksep', '0.9', false));
    this.Graph = this.Graph.concat(TextProperties('Arial', 24));
    this.Graph = this.Graph.concat(ColorSet('black', 'transparent', 'gray'));
    this.Graph = this.Graph.concat(createProperty('type', 'Graph', false));

    this.Assumption = [];
    this.Assumption = this.Assumption.concat(createProperty('rankdir', 'LR', false));
    this.Assumption = this.Assumption.concat(createProperty('splines','true', false));
    this.Assumption = this.Assumption.concat(createProperty('overlap','false', false));
    this.Assumption = this.Assumption.concat(createProperty('nodesep','0.2', false));
    this.Assumption = this.Assumption.concat(createProperty('ranksep','0.9', false));
    this.Assumption = this.Assumption.concat(NodeProperties('filled, rounded', 'Times', 18, 'white', 'dimgray', 'dimgray'));
    this.Assumption = this.Assumption.concat(createProperty('type', 'Assumption', false));
    
    this.Policy = [];
    this.Policy = this.Policy.concat(createProperty('rankdir', 'LR', false));
    this.Policy = this.Policy.concat(createProperty('splines','true', false));
    this.Policy = this.Policy.concat(createProperty('overlap','false', false));
    this.Policy = this.Policy.concat(createProperty('nodesep','0.2', false));
    this.Policy = this.Policy.concat(createProperty('ranksep','0.9', false));
    this.Policy = this.Policy.concat(NodeProperties('filled, rounded', 'Arial', 18, 'black', 'darkolivegreen3', 'darkolivegreen3'));
    this.Policy = this.Policy.concat(createProperty('type', 'Policy', false));
    
    this.PreConditions = []
    this.PreConditions = this.PreConditions.concat(createProperty('shape', ShapeOptions.BOX, false))
    this.PreConditions = this.PreConditions.concat(NodeProperties('filled, rounded', 'Arial', 16, 'black', 'lightgray', 'gray'));
    this.PreConditions = this.PreConditions.concat(createProperty('type', 'PreCondition', false));
    
    this.Attack = []
    this.Attack = this.Attack.concat(createProperty('shape', ShapeOptions.BOX, false))
    this.Attack = this.Attack.concat(NodeProperties('filled, rounded', 'Arial', 16, 'white', 'red', 'red'));
    this.Attack = this.Attack.concat(createProperty('type', 'Attack', false));

    this.UnmitigatedAttack = []
    this.UnmitigatedAttack = this.UnmitigatedAttack.concat(createProperty('shape', ShapeOptions.BOX, false))
    this.UnmitigatedAttack = this.UnmitigatedAttack.concat(NodeProperties('filled, rounded', 'Arial', 16, 'red', 'yellow', 'red', 4));
    this.UnmitigatedAttack = this.UnmitigatedAttack.concat(createProperty('type', 'UnmitigatedAttack', false));
    
    this.PreEmptiveDefense = []
    this.PreEmptiveDefense = this.PreEmptiveDefense.concat(createProperty('shape', ShapeOptions.BOX, false));
    this.PreEmptiveDefense = this.PreEmptiveDefense.concat(NodeProperties('filled, rounded', 'Arial', 16, 'white', 'purple', 'blue'));
    this.PreEmptiveDefense = this.PreEmptiveDefense.concat(createProperty('type', 'PreEmptiveDefense', false));
    
    this.IncidentResponse = []
    this.IncidentResponse = this.IncidentResponse.concat(createProperty('shape', ShapeOptions.BOX, false));
    this.IncidentResponse = this.IncidentResponse.concat(NodeProperties('filled, rounded', 'Arial', 16, 'white', 'blue', 'blue'));
    this.IncidentResponse = this.IncidentResponse.concat(createProperty('type', 'IncidentResponse', false));
    
    this.EmptyDefense = []
    this.EmptyDefense = this.EmptyDefense.concat(createProperty('shape', ShapeOptions.BOX3D, false));
    this.EmptyDefense = this.EmptyDefense.concat(NodeProperties('filled, dashed', 'Arial', 16, 'black', 'transparent', 'blue'));
    this.EmptyDefense = this.EmptyDefense.concat(createProperty('type', 'EmptyDefense', false));
    
    this.EmptyAttack = []
    this.EmptyAttack = this.EmptyAttack.concat(createProperty('shape', ShapeOptions.BOX3D, false));
    this.EmptyAttack = this.EmptyAttack.concat(NodeProperties('filled, dashed', 'Arial', 16, 'black', 'transparent', 'red'));
    this.EmptyAttack = this.EmptyAttack.concat(createProperty('type', 'EmptyAttack', false));
    
    this.Reality = []
    this.Reality = this.Reality.concat(createProperty('shape', ShapeOptions.BOX, false)); 
    this.Reality = this.Reality.concat(NodeProperties('filled, rounded', 'Arial', 20, 'white', 'black', 'black'));
    this.Reality = this.Reality.concat(createProperty('type', 'Reality', false));
    
    this.AttackerWins = []
    this.AttackerWins = this.AttackerWins.concat(createProperty('shape', ShapeOptions.BOX, false));
    this.AttackerWins = this.AttackerWins.concat(NodeProperties('filled, rounded', 'Arial', 20, 'red', 'yellow', 'yellow'));
    this.AttackerWins = this.AttackerWins.concat(createProperty('type', 'AttackerWins', false));
}