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
    var theme = localStorage.getItem('theme');
    if (theme === null) {
        theme = 'eclipse';
    }
    themePicker.value = theme;
    // Initialize CodeMirror on a textarea
    editor = CodeMirror.fromTextArea(document.getElementById('codeInput'), {
        mode: 'adm',
        lineNumbers: true,
        gutters: ["CodeMirror-linenumbers", 'CodeMirror-errors'],
        theme: theme
    });

    const canvasContainer = document.getElementById('canvasContainer');

    // Load saved content from local storage
    var savedContent = localStorage.getItem('adm_content');
    if (savedContent) {
        editor.setValue(savedContent);
    }

    // Render ADM as part of page load
    const adm_content = editor.getValue();
    RenderSVGFromADM(adm_content);

    // Restore positions from localStorage
    var savedCanvasPosX = localStorage.getItem('canvasPosX');
    var savedCanvasPosY = localStorage.getItem('canvasPosY');
    if (savedCanvasPosX !== null && savedCanvasPosY !== null) {
        var canvasPosX = parseFloat(savedCanvasPosX);
        var canvasPosY = parseFloat(savedCanvasPosY);

        canvasContainer.style.left = canvasPosX + 'px';
        canvasContainer.style.top = canvasPosY + 'px';
    }

    // Restore properties from localStorage
    var savedPosX = localStorage.getItem('diagramPosX');
    var savedPosY = localStorage.getItem('diagramPosY');
    var savedScale = localStorage.getItem('diagramScale');

    if (savedPosX !== null && savedPosY !== null && savedScale !== null) {
        var posX = parseFloat(savedPosX);
        var posY = parseFloat(savedPosY);
        var scale = parseFloat(savedScale);

        diagramArea.style.left = posX + 'px';
        diagramArea.style.top = posY + 'px';
        currentScale = scale;
        updateZoomPercentage(scale);
        diagramArea.style.transform = `scale(${currentScale})`;
    }

    editor.on('cursorActivity', cursorActivityHandler); // when a chunk of text is selected
    editor.on('keydown', keydownHandler); // when a key is pressed
    editor.on('change', contentChangeHandler); // re-render everytime content changes

    // canvas dragging event handlers (to move the image around)
    canvasContainer.addEventListener('mousedown', moveStartHandler);
    document.addEventListener('mouseup', moveEndHandler);
    document.addEventListener('mousemove',  moveHandler);

    canvasContainer.addEventListener('touchstart', moveStartHandler);
    document.addEventListener('touchend', moveEndHandler);
    document.addEventListener('touchmove',  moveHandler);

    // zoom-in and zoom-out
    canvasContainer.addEventListener('wheel', zoomHandler);
    
    document.getElementById('zoomOutButton').addEventListener('click', function() {
        zoomAtPoint(0.96, window.innerWidth / 2, window.innerHeight / 2);
    });
    
    document.getElementById('zoomInButton').addEventListener('click', function() {
        zoomAtPoint(1.04, window.innerWidth / 2, window.innerHeight / 2);
    });

    // Theme Picker
    document.getElementById('themePicker').addEventListener('change', function (event) {
        editor.setOption('theme', event.target.value);
        localStorage.setItem('theme', event.target.value);
    });

    // Open File
    document.getElementById('open').addEventListener('click', openButtonHandler);
    document.getElementById('openFile').addEventListener('change', openFileHandler);
    // Save file
    document.getElementById('save').addEventListener('click', saveButtonHandler);
    // Palette
    document.getElementById('colors').addEventListener('click', paletteHandler);
    
    // Maximize, minimize buttons for code area
    var maximizeHeightButton = document.getElementById('maximizeHeightButton');
    var maximizeWidthButton = document.getElementById('maximizeWidthButton');
    var minimizeButton = document.getElementById('minimizeButton');
    
    // Help button
    document.getElementById('help').addEventListener('click', helpButtonHandler);
    // Close the modal when the 'X' button is clicked
    document.getElementById('closeHelp').addEventListener('click', function() {
        document.getElementById('helpModal').style.display = 'none';
    });
    // Close the modal when a click occurs outside the modal
    window.addEventListener('click', function(event) {
        if (event.target == document.getElementById('helpModal')) {
            document.getElementById('helpModal').style.display = 'none';
        }
    });
    
    var codeArea = document.getElementById('codeArea');

    var isHeightMaximized = false;
    var isWidthMaximized = false;

    maximizeHeightButton.addEventListener('click', function() {
        if (!isHeightMaximized) {
            previousHeight = codeArea.style.height;
            codeArea.style.height = '85vh';
            maximizeHeightButton.textContent = 'bottom_panel_close';
            isHeightMaximized = true;
        } else {
            codeArea.style.height = previousHeight; // Reset to previous height
            maximizeHeightButton.textContent = 'bottom_panel_open';
            isHeightMaximized = false;
        }
        editor.refresh();
    });
    
    maximizeWidthButton.addEventListener('click', function() {
        if (!isWidthMaximized) {
            previousWidth = codeArea.style.width;
            codeArea.style.width = '98vw';
            maximizeWidthButton.textContent = 'right_panel_close';
            isWidthMaximized = true;
        } else {
            codeArea.style.width = previousWidth; // Reset to previous width
            maximizeWidthButton.textContent = 'right_panel_open';
            isWidthMaximized = false;
        }
        editor.refresh();
    });

    minimizeButton.addEventListener('click', function() {
        if (codeArea.style.height !== '40px') {
            previousHeight = codeArea.style.height; // Update previous height before minimizing
            codeArea.style.height = '40px';
            minimizeButton.textContent = 'expand_less'; // Change to up arrowhead
        } else {
            codeArea.style.height = previousHeight; // Restore to previous height
            minimizeButton.textContent = 'expand_more'; // Change to down arrowhead
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

        // Select all nodes with yellow fill
        const yellowNodes = svgDoc.querySelectorAll('svg g.node path[fill="#ffff00"]');

        // Apply the animations to each yellow node
        yellowNodes.forEach(node => {
            node.appendChild(createStrokeAnimation()); // Apply fill animation
        });

        var serializer = new XMLSerializer();
        var modifiedSvgString = serializer.serializeToString(svgDoc);

        diagramArea.innerHTML = modifiedSvgString;
    }
}

// Function to create an animation element for stroke
function createStrokeAnimation() {
    const animateStroke = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animateStroke.setAttribute('attributeName', 'stroke');
        animateStroke.setAttribute('values', 'red;yellow;red');
        animateStroke.setAttribute('dur', '3s');
        animateStroke.setAttribute('repeatCount', 'indefinite');
        animateStroke.setAttribute('calcMode', 'discrete');
        return animateStroke;
}