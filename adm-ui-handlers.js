function cursorActivityHandler(instance, changeObj) {
    // Clear existing marks first
    const marks = instance.getAllMarks();
    for (let i = 0; i < marks.length; i++) {
        marks[i].clear();
    }
    
    // Get the selected text
    const selectedText = instance.getSelection();

    // If there is selected text
    if (selectedText) {
        // Get the total line count
        const totalLines = instance.lineCount();

        // Loop through each line
        for (let i = 0; i < totalLines; i++) {
            // Get the text of the line
            const lineText = instance.getLine(i);

            // If the line contains the selected text
            if (lineText.includes(selectedText)) {
                // Find the start and end positions of the selected text in the line
                const startPos = { line: i, ch: lineText.indexOf(selectedText) };
                const endPos = { line: i, ch: startPos.ch + selectedText.length };

                // Highlight the text
                instance.markText(startPos, endPos, { className: 'CodeMirror-selected' });
            }
        }
    }
}

// Autoindent when user types ENTER. This is to make it easier to write models
// on tablet/mobile.
function keydownHandler(cm, event) {
    regex = /^(Model:|\s*Attack:|\s*Defense:|\s*Assumption:|\s*Policy:)/;
    if (event.key === 'Enter') {
        let cursor = cm.getCursor();
        let line = cm.getLine(cursor.line);
        let match = line.match(regex);
        if (match) {
            let currentIndent = line.search(/\S|$/) / 2;
            let indent;
            switch (match[0].trim()) {
                case 'Model:':
                case 'Attack:':
                case 'Defense:':
                case 'Assumption:':
                case 'Policy:':
                    indent = currentIndent + 2;
                    break;
                default:
                    indent = 0;
            }
            console.log('indent: ', indent)
            cm.operation(function() {
                cm.replaceSelection("\n" + Array(indent * cm.getOption("indentUnit") + 1).join(" "));
            });
            event.preventDefault();
        }
    }
}

function contentChangeHandler(editor) {
    // push changes to local storage
    localStorage.setItem('adm_content', editor.getValue());

    // get the contents of CodeMirror instance as a string
    const adm_content = editor.getValue();
    if (adm_content === '') {
        // clear canvas if there is no content
        resetCanvas();
        return;
    }
    RenderSVGFromADM(adm_content);
}

let isDragging = false;
let lastX, lastY;
let pinchDistance = 0;
function moveStartHandler(e) {
    e.preventDefault(); // Prevent the default scrolling behavior
    isDragging = true;
    if (e.constructor.name == 'TouchEvent') {
        switch (e.touches.length) {
            case 1: // Single finger
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            case 2: // Pinch
                // Calculate the distance between the two fingers
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                pinchDistance = Math.sqrt(dx * dx + dy * dy);
                break;
        }
        
    } else if (e.constructor.name == 'MouseEvent') {
        lastX = e.clientX;
        lastY = e.clientY;
    }
    canvasContainer.style.cursor = 'grabbing';
    // Add the class to disable text selection when dragging starts
    document.body.classList.add('no-select');
    // Add this class to any other elements that need it, e.g., the code area
    document.getElementById('codeInput').classList.add('no-select');
}

function moveEndHandler() {
    isDragging = false;
    canvasContainer.style.cursor = 'grab';
    // Remove the class to re-enable text selection when dragging ends
    document.body.classList.remove('no-select');
    // Remove from other elements too
    document.getElementById('codeInput').classList.remove('no-select');
}

function moveHandler(e) {
    var clientX, clientY;
    if (e.constructor.name == 'TouchEvent') {
        switch (e.touches.length) {
            case 1: // Single finger
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
                break;
            case 2: // Pinch
                e.preventDefault(); // Prevent the default pinch behavior
                // Calculate the distance between the two fingers
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const newPinchDistance = Math.sqrt(dx * dx + dy * dy);
                const scaleFactor = newPinchDistance / pinchDistance;
                pinchDistance = newPinchDistance;
                zoomAtPoint(scaleFactor, (e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
                return;
        }
    } else if (e.constructor.name == 'MouseEvent') {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    if (isDragging) {
        let deltaX = clientX - lastX;
        let deltaY = clientY - lastY;

        // Move the container
        let currentLeft = canvasContainer.offsetLeft + deltaX;
        let currentTop = canvasContainer.offsetTop + deltaY;

        canvasContainer.style.left = currentLeft + 'px';
        canvasContainer.style.top = currentTop + 'px';

        lastX = clientX;
        lastY = clientY;

        // Save position to localStorage
        localStorage.setItem('canvasPosX', canvasContainer.style.left);
        localStorage.setItem('canvasPosY', canvasContainer.style.top);
    }
}

function zoomHandler(e) {
    const scaleFactor = e.deltaY > 0 ? 0.96 : 1.04; // Adjust scaling factor as needed
    zoomAtPoint(scaleFactor, e.clientX, e.clientY);
    e.preventDefault(); // Prevent the default scrolling behavior
}

function initializeResizableCodeArea(editor) {
    var codeArea = document.getElementById('codeArea');
    var startWidth = 0;
    var startHeight = 0;
    var startX = 0;
    var startY = 0;

    var doDragHorizontal = function(e) {
        var newWidth = startWidth - (e.clientX - startX);
        codeArea.style.width = newWidth + 'px';
        editor.refresh();
    };

    var doDragVertical = function(e) {
        var newHeight = startHeight - (e.clientY - startY);
        codeArea.style.height = newHeight + 'px';
        editor.refresh();
    };

    var doDragCorner = function(e) {
        var newWidth = startWidth - (e.clientX - startX);
        var newHeight = startHeight - (e.clientY - startY);
        codeArea.style.width = newWidth + 'px';
        codeArea.style.height = newHeight + 'px';
        editor.refresh();
    };

    var startDragHorizontal = function(e) {
        codeArea.style.transition = 'none'; // Disable transitions while dragging
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(codeArea).width, 10);
        document.documentElement.addEventListener('mousemove', doDragHorizontal, false);
        document.documentElement.addEventListener('mouseup', stopDrag, false);
    };

    var startDragVertical = function(e) {
        codeArea.style.transition = 'none'; // Disable transitions while dragging
        startY = e.clientY;
        startHeight = parseInt(document.defaultView.getComputedStyle(codeArea).height, 10);
        document.documentElement.addEventListener('mousemove', doDragVertical, false);
        document.documentElement.addEventListener('mouseup', stopDrag, false);
    };

    var startDragCorner = function(e) {
        codeArea.style.transition = 'none'; // Disable transitions while dragging
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(codeArea).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(codeArea).height, 10);
        document.documentElement.addEventListener('mousemove', doDragCorner, false);
        document.documentElement.addEventListener('mouseup', stopDrag, false);
    };

    var stopDrag = function() {
        document.documentElement.removeEventListener('mousemove', doDragHorizontal, false);
        document.documentElement.removeEventListener('mousemove', doDragVertical, false);
        document.documentElement.removeEventListener('mousemove', doDragCorner, false);
        document.documentElement.removeEventListener('mouseup', stopDrag, false);
        // Re-enable transitions after a slight delay
        setTimeout(function() {
            codeArea.style.transition = 'width 0.3s ease, height 0.3s ease';
        }, 50);
    };

    var leftHandle = document.querySelector('.resize-handle.left');
    var topHandle = document.querySelector('.resize-handle.top');
    var cornerHandle = document.querySelector('.resize-handle.corner');

    leftHandle.addEventListener('mousedown', startDragHorizontal, false);
    topHandle.addEventListener('mousedown', startDragVertical, false);
    cornerHandle.addEventListener('mousedown', startDragCorner, false);
}

//////////////////////////////////////////////////
// Auxiliary functions used by handlers

let currentScale = 1; // Starting scale, where 1 represents the original size

function zoomAtPoint(scaleFactor, mouseX, mouseY) {
    const diagramArea = document.getElementById('diagramArea');
    const rect = diagramArea.getBoundingClientRect();

    // Calculate the mouse's position relative to the diagram area
    const relativeX = mouseX - rect.left - window.scrollX;
    const relativeY = mouseY - rect.top - window.scrollY;

    // Calculate the new scale
    const newScale = currentScale * scaleFactor;

    // Calculate the position adjustment based on the scaling
    const newPositionX = (relativeX * scaleFactor) - relativeX;
    const newPositionY = (relativeY * scaleFactor) - relativeY;

    // Update current scale and position
    if (newScale > 0.2 && newScale < 4) {
        currentScale = newScale;
        updateZoomPercentage(currentScale); // Update the zoom percentage display
        const currentLeft = parseFloat(diagramArea.style.left || 0);
        const currentTop = parseFloat(diagramArea.style.top || 0);
        diagramArea.style.transform = `scale(${currentScale})`;
        diagramArea.style.left = `${currentLeft - newPositionX}px`;
        diagramArea.style.top = `${currentTop - newPositionY}px`;

        // Save scale to localStorage
        localStorage.setItem('diagramScale', currentScale);
        localStorage.setItem('diagramPosX', diagramArea.style.left);
        localStorage.setItem('diagramPosY', diagramArea.style.top);

        // Adjust background grid size
        const newBackgroundSize = 25 * currentScale; // Assuming 100px is the initial size
        canvasContainer.style.backgroundSize = `${newBackgroundSize}px ${newBackgroundSize}px`;
    }
}

function updateZoomPercentage(scale) {
    const zoomPercent = Math.round(scale * 100); // Convert scale to percentage
    document.getElementById('zoomPercentage').textContent = zoomPercent + '%';
}

// 'Open' handlers
function openButtonHandler() {
    document.getElementById('openFile').click();
}
function openFileHandler(e) {
    var file = e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
        var contents = e.target.result;
        editor.setValue(contents);
    };
    reader.readAsText(file);

    // reset canvas position and zoom levels.
    resetCanvas();
}

async function helpButtonHandler() {
    let markdown = ``;
    let response = await fetch('doc/help.md');
    if (response.ok) {
        markdown = await response.text();
    }

    Prism.languages.custom = {
        'keyword': /^(\s*Model:|\s*Attack:|\s*Defense:|\s*Assumption:|\s*Policy:|\s*Given|\s*When|\s*Then|\s*And|\s*But|\s*\@\w+)/gm,
        'string': /\[.*?\]/g
    };
    showdown.extension('prism', function() {
        return [{
            type: 'output',
            filter: function(text, converter, options) {
                return text.replace(/<pre><code\b[^>]*>([\s\S]*?)<\/code><\/pre>/g, function(match, code) {
                    code = showdown.helper.unescapeHTMLEntities(code);
                    return '<pre><code class="language-custom">' + Prism.highlight(code, Prism.languages.custom) + '</code></pre>';
                });
            }
        }];
    });

    let converter = new showdown.Converter({ extensions: [/*'collapseh2', 'collapseh3',*/ 'prism'] });
    let html = converter.makeHtml(markdown);
    document.getElementById('textContent').innerHTML = html;
    document.getElementById('helpModal').style.display = 'block';
}

function resetCanvas() {
    // reset canvasContainer and diagramArea
    canvasContainer.style.top = '50%';
    canvasContainer.style.left = '50%';
    diagramArea.style.left = '0px';
    diagramArea.style.top = '0px';
    diagramArea.width = '100%';
    diagramArea.height = '100%';
    currentScale = 1;
    updateZoomPercentage(currentScale);
    diagramArea.style.transform = `scale(${currentScale})`;
    diagramArea.innerHTML = '';

    // clear localstorage parameters
    localStorage.removeItem('canvasPosX');
    localStorage.removeItem('canvasPosY');
    localStorage.removeItem('diagramScale');
    localStorage.removeItem('diagramPosX');
    localStorage.removeItem('diagramPosY');
}

// 'Save' handler
function saveButtonHandler() {
    var text = editor.getValue();
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', 'adm_model.adm');

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

// 'Palette' handler
function paletteHandler() {
    var colorLegend = document.getElementById('colorLegend');
    var colorsButton = document.getElementById('colors');
    if (colorLegend.style.display === 'none' || colorLegend.style.display === '') {
        colorLegend.style.display = 'flex';
        colorsButton.style.color = 'lightgreen';
        colorsButton.style.textShadow = '0 0 8px rgba(117, 117, 117, 0.7)';
    } else {
        // Revert back to default color
        colorLegend.style.display = 'none';
        colorsButton.style.color = '';
        colorsButton.style.textShadow = '';
    }
}