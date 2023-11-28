// Customize Gherkin mode to support ADM keywords
CodeMirror.defineMode("adm", function(config) {
    // Define the nested mode for docstrings.
    // NOTE: All docstrings use string highlighting color.
    //       Currently there is no language-specific highlighting.
    let tripleQuotesMode = {
        startState: function() {
            return {
                inString: false,
                language: null,
                languageState: null,
                end: false,
                stringStart: null
            };
        },
        token: function(stream, state) {
            if (!state.inString) {
                if (stream.match('"""')) {
                    state.inString = true;
                    return "string";
                } else {
                    stream.next();
                    return null;
                }
            } else {
                if (stream.match('"""')) {
                    state.inString = false;
                    return "string";
                }
                if (state.inString) {
                    while (!stream.eol() && !stream.match('"""', false)) {
                        stream.next();
                    }
                    return "string";
                }
            }
        }
    };

    // Combine the "adm" mode with the nested mode
    let admMode = CodeMirror.overlayMode(CodeMirror.getMode(config, "gherkin"), {
        token: function(stream) {
            if (stream.match("Model:") || stream.match("Attack:") || stream.match("Defense:") || 
                stream.match("Assumption:") || stream.match("Policy:") || 
                stream.match("Given") || stream.match("When") || stream.match("Then") || 
                stream.match("And") || stream.match("But")) {
                return "keyword"; // Use CodeMirror's keyword style
            }

            while (stream.next() != null && !stream.match(/^\s*(Model:|Attack:|Defense:|Assumption:|Policy:|Given|When|Then|And|But)/, false)) {}
            return null;
        }
    }, true); // The true flag here is important for integrating with the underlying mode

    return CodeMirror.overlayMode(admMode, tripleQuotesMode);
});

// Connect event listeners on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize CodeMirror on a textarea
    var editor = CodeMirror.fromTextArea(document.getElementById('codeInput'), {
        mode: 'adm',
        lineNumbers: true,
        gutters: ["CodeMirror-linenumbers", 'CodeMirror-errors'],
        theme: 'eclipse'
    });

    // Render ADM as part of page load
    const adm_content = editor.getValue();
    RenderSVGFromADM(adm_content);

    editor.on('cursorActivity', cursorActivityHandler); // when a chunk of text is selected
    editor.on('change', contentChangeHandler); // re-render everytime content changes

    // canvas dragging event handlers (to move the image around)
    const canvasContainer = document.getElementById('canvasContainer');
    canvasContainer.addEventListener('mousedown', mouseDownForDragging);
    document.addEventListener('mouseup', mouseUpForDragging);
    document.addEventListener('mousemove',  mousemoveForDragging);

    // zoom-in and zoom-out
    canvasContainer.addEventListener('wheel', zoomHandler);

    // Theme Picker
    document.getElementById('themePicker').addEventListener('change', function (event) {
        editor.setOption('theme', event.target.value);
    });
    
    // Maximize, minimize buttons for code area
    var maximizeHeightButton = document.getElementById('maximizeHeightButton');
    var maximizeWidthButton = document.getElementById('maximizeWidthButton');
    var minimizeButton = document.getElementById('minimizeButton');
    var codeArea = document.getElementById('codeArea');

    var isHeightMaximized = false;
    var isWidthMaximized = false;

    maximizeHeightButton.addEventListener('click', function() {
        if (!isHeightMaximized) {
            previousHeight = codeArea.style.height;
            codeArea.style.height = '98vh';
            maximizeHeightButton.textContent = '⏊';
            isHeightMaximized = true;
        } else {
            codeArea.style.height = previousHeight; // Reset to previous height
            maximizeHeightButton.textContent = '⏉';
            isHeightMaximized = false;
        }
        editor.refresh();
    });
    
    maximizeWidthButton.addEventListener('click', function() {
        if (!isWidthMaximized) {
            previousWidth = codeArea.style.width;
            codeArea.style.width = '98vw';
            maximizeWidthButton.textContent = '┤';
            isWidthMaximized = true;
        } else {
            codeArea.style.width = previousWidth; // Reset to previous width
            maximizeWidthButton.textContent = '├';
            isWidthMaximized = false;
        }
        editor.refresh();
    });

    minimizeButton.addEventListener('click', function() {
        if (codeArea.style.height !== '40px') {
            previousHeight = codeArea.style.height; // Update previous height before minimizing
            codeArea.style.height = '40px';
            minimizeButton.textContent = '▲'; // Change to up arrowhead
        } else {
            codeArea.style.height = previousHeight; // Restore to previous height
            minimizeButton.textContent = '▼'; // Change to down arrowhead
        }
        editor.refresh();
    });

    // Code area must be resizable using mouse
    initializeResizableCodeArea(editor);
});

//////////////////////////////////////////////////
// ADM, Graphviz and SVG processing functions

function RenderSVGFromADM(adm_content) {
    try {
        graphvizCode = ADMToGraphviz(adm_content);
        //console.log(graphvizCode);

        if (isValidGraphviz(graphvizCode)) {
            convertGraphvizToSVG(graphvizCode).then(renderGraphviz);
        }

        // remove all error gutter markers
        var editor = document.querySelector('.CodeMirror').CodeMirror;
        var gutters = editor.getOption('gutters');
        for (gutter of gutters) {
            if (gutter === 'CodeMirror-errors')
                editor.clearGutter(gutter);
        }
    } catch (error) {
        // if error is GherkinException, show error message
        if (error.constructor.name === 'CompositeParserException') {
            console.error("Error rendering ADM:", error);
            // error is an array of errors. It has a line and column number
            // for each error. Pick the line number and show a error emoji in the gutter
            for (err of error.errors) {
                var line = err.location.line;
                // get editor instance
                var editor = document.querySelector('.CodeMirror').CodeMirror;
                // point to the line in the code editor's gutter
                editor.setGutterMarker(line - 1, 'CodeMirror-errors', makeMarker(err.message));
            }
        }
    }
}

function makeMarker(details) {
    var marker = document.createElement('div');
    marker.style.color = 'red';
    marker.innerHTML = '⛔️';
    // show error message on hover
    marker.setAttribute('title', details);
    // show error message on click
    marker.addEventListener('click', function() {
        alert(details);
    });
    return marker;
}

function isValidGraphviz(dotString) {
    // Implement your validation logic here
    // For now, let's assume all non-empty strings are valid
    return dotString && dotString.length > 0;
}

function convertGraphvizToSVG(dotString) {
    try {
        var viz = new Viz();
        return viz.renderString(dotString, { engine: "dot", format: "svg" })
            .then(function(svg) {
                return svg; // Returns the SVG
            })
            .catch(function(error) {
                // Handle errors if necessary
                console.error("Graphviz rendering error:", error);
                return null;
            });
    } catch (error) {
        console.error("Error creating Viz instance:", error);
        return null;
    }
}

function renderGraphviz(svg) {
    if (svg) {
        var parser = new DOMParser();
        var svgDoc = parser.parseFromString(svg, "image/svg+xml");
        var diagramArea = document.getElementById('diagramArea');
        diagramArea.innerHTML = ''; // Clear existing content

        var polygons = svgDoc.querySelectorAll('polygon');

        polygons.forEach(function(polygon) {
            // Change the fill attribute to transparent
            polygon.setAttribute('fill', 'transparent');
        });

        var serializer = new XMLSerializer();
        var modifiedSvgString = serializer.serializeToString(svgDoc);

        diagramArea.innerHTML = modifiedSvgString;
    }
}