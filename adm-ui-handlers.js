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

function contentChangeHandler(instance) {
    // get the contents of CodeMirror instance as a string
    const adm_content = instance.getValue();
    RenderSVGFromADM(adm_content);
}

let isDragging = false;
let lastX, lastY;

function mouseDownForDragging(e) {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvasContainer.style.cursor = 'grabbing';
    // Add the class to disable text selection when dragging starts
    document.body.classList.add('no-select');
    // Add this class to any other elements that need it, e.g., the code area
    document.getElementById('codeInput').classList.add('no-select');
}

function mouseUpForDragging() {
    isDragging = false;
    canvasContainer.style.cursor = 'grab';
    // Remove the class to re-enable text selection when dragging ends
    document.body.classList.remove('no-select');
    // Remove from other elements too
    document.getElementById('codeInput').classList.remove('no-select');
}

function mousemoveForDragging(e) {
    if (isDragging) {
        let deltaX = e.clientX - lastX;
        let deltaY = e.clientY - lastY;

        // Move the container
        let currentLeft = canvasContainer.offsetLeft + deltaX;
        let currentTop = canvasContainer.offsetTop + deltaY;

        canvasContainer.style.left = currentLeft + 'px';
        canvasContainer.style.top = currentTop + 'px';

        lastX = e.clientX;
        lastY = e.clientY;
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
    currentScale = newScale;
    updateZoomPercentage(currentScale); // Update the zoom percentage display
    const currentLeft = parseFloat(diagramArea.style.left || 0);
    const currentTop = parseFloat(diagramArea.style.top || 0);
    diagramArea.style.transform = `scale(${currentScale})`;
    diagramArea.style.left = `${currentLeft - newPositionX}px`;
    diagramArea.style.top = `${currentTop - newPositionY}px`;

    // Adjust background grid size
    const newBackgroundSize = 100 * currentScale; // Assuming 100px is the initial size
    canvasContainer.style.backgroundSize = `${newBackgroundSize}px ${newBackgroundSize}px`;
}

function updateZoomPercentage(scale) {
    const zoomPercent = Math.round(scale * 100); // Convert scale to percentage
    document.getElementById('zoomPercentage').textContent = zoomPercent + '%';
}