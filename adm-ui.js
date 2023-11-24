CodeMirror.defineMode("adm", function(config) {
    return CodeMirror.overlayMode(CodeMirror.getMode(config, "gherkin"), {
        token: function(stream) {
            if (stream.match("Model:") || stream.match("Attack:") || stream.match("Defense:") || 
                stream.match("Assumptions:") || stream.match("Policy:") || 
                stream.match("Given") || stream.match("When") || stream.match("Then") || 
                stream.match("And") || stream.match("But")) {
                return "keyword"; // Use CodeMirror's keyword style
            }
            while (stream.next() != null && !stream.match(/^\s*(Model:|Attack:|Defense:|Assumptions:|Policy:|Given|When|Then|And|But)/, false)) {}
            return null;
        }
    }, true); // The true flag here is important for integrating with the underlying mode
});

document.addEventListener('DOMContentLoaded', function() {
    // Initialize CodeMirror on a textarea
    var editor = CodeMirror.fromTextArea(document.getElementById('codeInput'), {
        mode: 'adm',
        lineNumbers: true,
        theme: 'eclipse'
    });

    editor.on('change', function(instance) {
        // get the contents of CodeMirror instance as a string
        const adm_content = instance.getValue();
        graphvizCode = ADMToGraphviz(adm_content);
        //console.log(graphvizCode);

        if (isValidGraphviz(graphvizCode)) {
            convertGraphvizToSVG(graphvizCode).then(function(svg) {
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
            });
        }
    });

    let isDragging = false;
    let lastX, lastY;

    const canvasContainer = document.getElementById('canvasContainer');

    canvasContainer.addEventListener('mousedown', function(e) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvasContainer.style.cursor = 'grabbing';
        // Add the class to disable text selection when dragging starts
        document.body.classList.add('no-select');
        // Add this class to any other elements that need it, e.g., the code area
        document.getElementById('codeInput').classList.add('no-select');
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
        canvasContainer.style.cursor = 'grab';
        // Remove the class to re-enable text selection when dragging ends
        document.body.classList.remove('no-select');
        // Remove from other elements too
        document.getElementById('codeInput').classList.remove('no-select');
    });

    // add eventlisterners for zoom-in and zoom-out mouse events
    canvasContainer.addEventListener('wheel', function(e) {
        const scaleFactor = e.deltaY > 0 ? 0.96 : 1.04; // Adjust scaling factor as needed
        zoomAtPoint(scaleFactor, e.clientX, e.clientY);
        e.preventDefault(); // Prevent the default scrolling behavior
    });

    document.addEventListener('mousemove', function(e) {
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
    });

    // Theme Picker
    document.getElementById('themePicker').addEventListener('change', function(event) {
        editor.setOption('theme', event.target.value);
    });

    // Minimize Button
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

    // Resizable Code Area
    initializeResizableCodeArea(editor);
});

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

function isValidGraphviz(dotString) {
    // Implement your validation logic here
    // For now, let's assume all non-empty strings are valid
    return dotString && dotString.length > 0;
}

var dotString = `
digraph "top" {
    // Base Styling
    compound=true
    graph[style="filled, rounded" rankdir="LR" splines="true" overlap="false" nodesep="0.2" ranksep="0.9"];
  
    // Start and end nodes
    reality[ label="Reality"  fontname="Arial"  fontsize="20"  fontcolor="white"  fillcolor="black"  color="black"  shape="box"  style="filled, rounded" ]
    attacker_wins[ label="ATTACKER WINS!"  fontname="Arial"  fontsize="20"  fontcolor="red"  fillcolor="yellow"  color="yellow"  shape="box"  style="filled, rounded" ]
    subgraph cluster_User_redirection_to_malicious_domains {
      label=<<B>User redirection<br></br>to malicious<br></br>domains</B>>
      graph[style="filled, rounded" rankdir="LR" splines="true" overlap="false" nodesep="0.2" ranksep="0.9" fontname="Arial"  fontsize="24"  fontcolor="black"  fillcolor="transparent"  color="gray" ];
      a_registered_redirection_URI[label="a registered\nredirection URI"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      Partial_URIs_are_considered_valid[label="Partial URIs are\nconsidered valid"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="red"  color="red"]
      Require_clients_to_register_full_redirection_URI_and_partial_versions_of_these_URIs_must_trigger_a_error_response[label="Require clients\nto register full\nredirection URI and partial\nversions of these URIs must\ntrigger a error response."  shape="box3d"  style="filled, dashed"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="transparent"  color="blue"]
      {rank="same"; a_registered_redirection_URI; }
    }
    reality -> a_registered_redirection_URI
    reality -> Require_clients_to_register_full_redirection_URI_and_partial_versions_of_these_URIs_must_trigger_a_error_response
    a_registered_redirection_URI -> Partial_URIs_are_considered_valid
    subgraph cluster_Enduser_phishing {
      label=<<B>End-user<br></br>phishing</B>>
      graph[style="filled, rounded" rankdir="LR" splines="true" overlap="false" nodesep="0.2" ranksep="0.9" fontname="Arial"  fontsize="24"  fontcolor="black"  fillcolor="transparent"  color="gray" ];
      Embed_web_UI_component[label="Embed web UI\ncomponent"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="red"  color="red"]
      End_user_email_phishing[label="End user email\nphishing"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="red"  color="red"]
      Never_load_contents_from_external_sources_in_authentication_page[label="Never load\ncontents from external\nsources in\nauthentication page"  shape="box3d"  style="filled, dashed"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="transparent"  color="blue"]
      Client_should_never_ask_for_credentials[label="Client should\nnever ask for\ncredentials"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      Verify_senders_email[label="Verify sender's\nemail"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      {rank="same"; }
    }
    reality -> Embed_web_UI_component
    reality -> End_user_email_phishing
    reality -> Never_load_contents_from_external_sources_in_authentication_page
    End_user_email_phishing -> Client_should_never_ask_for_credentials
    End_user_email_phishing -> Verify_senders_email
    subgraph cluster_Add_additional_security_controls_around_public_clients {
      label=<<B>Add additional<br></br>security controls around<br></br>public clients</B>>
      graph[style="filled, rounded" rankdir="LR" splines="true" overlap="false" nodesep="0.2" ranksep="0.9" fontname="Arial"  fontsize="24"  fontcolor="black"  fillcolor="transparent"  color="gray" ];
      client_is_public_client             [label="client is public\nclient"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      Client_secrets_revocation[label="Client secrets\nrevocation"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      User_consent_for_public_clients[label="User consent for\npublic clients"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      Deployment_specific_client_secrets[label="Deployment\nspecific client secrets"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      {rank="same"; client_is_public_client               ; client_is_public_client               ; }
    }
    reality -> client_is_public_client            [ label="#fomosec"  penwidth="2"  color="red"  fontname="Arial"  fontcolor="red" ]
    reality -> Client_secrets_revocation[ label="#fomosec"  penwidth="2"  color="red"  fontname="Arial"  fontcolor="red" ]
    client_is_public_client                -> Deployment_specific_client_secrets
    client_is_public_client                -> User_consent_for_public_clients
    subgraph cluster_Security_of_refresh_tokens {
      label=<<B>Security of<br></br>refresh tokens</B>>
      graph[style="filled, rounded" rankdir="LR" splines="true" overlap="false" nodesep="0.2" ranksep="0.9" fontname="Arial"  fontsize="24"  fontcolor="black"  fillcolor="transparent"  color="gray" ];
      Refresh_token_security_on_webservers[label="Refresh token\nsecurity on web-servers"  shape="box3d"  style="filled, dashed"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="transparent"  color="blue"]
      Authenticate_client[label="Authenticate\nclient"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      {rank="same"; }
    }
    reality -> Refresh_token_security_on_webservers
    reality -> Authenticate_client[ label="#fomosec"  penwidth="2"  color="red"  fontname="Arial"  fontcolor="red" ]
    subgraph cluster_Client_secrets_and_keys {
      label=<<B>Client secrets<br></br>and keys</B>>
      graph[style="filled, rounded" rankdir="LR" splines="true" overlap="false" nodesep="0.2" ranksep="0.9" fontname="Arial"  fontsize="24"  fontcolor="black"  fillcolor="transparent"  color="gray" ];
      Secrets_extracted_via_path_traversal[label="Secrets\nextracted via path\ntraversal"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="red"  color="red"]
      Secrets_extracted_from_code[label="Secrets\nextracted from code"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="red"  color="red"]
      Secrets_extracted_from_app_binary[label="Secrets\nextracted from app binary"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="red"  color="red"]
      Compromize_web_server[label="Compromize web\nserver"  shape="box3d"  style="filled, dashed"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="transparent"  color="red"]
      Store_secrets_and_keys_in_vault[label="Store secrets and\nkeys in vault"  shape="box3d"  style="filled, dashed"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="transparent"  color="blue"]
      Dont_publish_code_containing_secrets[label="Don't publish\ncode containing\nsecrets"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="blue"  color="blue"]
      application_uses_config_files_for_secrets[label="application uses\nconfig files for secrets"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      secrets_and_keys_are_stored_in_configuration_file[label="secrets and keys\nare stored in\nconfiguration file"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      code_repo_access[label="code repo access"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      Webserver_shouldnt_serve_config_files[label="Web-server\nshouldn't serve config\nfiles"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      use_Apache_Web_Server_v2551_or_later[label="use Apache Web\nServer v2.5.51 or later"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      Block_encoded_paths[label="Block encoded\npaths"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      Secrets_extracted_via_encoded_path_in_URL_sent_to_Apache_Web_Server[label="Secrets\nextracted via encoded path\nin URL sent to Apache\nWeb Server"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="red"  color="red"]
      webserver_is_Apache_version_lteq_v2550[label="web-server is\nApache (version <=\nv2.5.50)"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      secrets_are_stored_in_configuration_file[label="secrets are\nstored in configuration\nfile"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      webserver_is_vulnerable_to_path_traversal_via_encoded_URLs[label="web-server is\nvulnerable to path traversal\nvia encoded URLs"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      webapplication_uses_input_to_calculate_config_file_path[label="web-application\nuses input to\ncalculate config file path"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      Dont_store_secrets_in_config_file[label="Don't store\nsecrets in config file"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="blue"  color="blue"]
      Encrypt_secrets_before_storing_in_file[label="Encrypt secrets\nbefore storing in file"  shape="box3d"  style="filled, dashed"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="transparent"  color="blue"]
      Dont_publish_app_binary_containing_secrets[label="Don't publish app\nbinary containing\nsecrets"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      Secrets_extracted_via_webserver_path_traversal[label="Secrets\nextracted via web-server\npath traversal"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="red"  color="red"]
      application_uses_webconfig_files_for_secrets[label="application uses\nweb-config files for secrets"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      app_binary_access[label="app binary access"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      webapplication_config_file_exposed_via_URL[label="web-application\nconfig file exposed via\nURL"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      Secrets_extracted_via_encoded_path_in_URL[label="Secrets\nextracted via encoded path\nin URL"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="red"  color="red"]
      Dont_allow_path_traversal_to_configuration_files[label="Don't allow path\ntraversal to configuration\nfiles"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      {rank="same"; secrets_are_stored_in_configuration_file; webserver_is_vulnerable_to_path_traversal_via_encoded_URLs; webserver_is_Apache_version_lteq_v2550; secrets_are_stored_in_configuration_file; code_repo_access; app_binary_access; webapplication_uses_input_to_calculate_config_file_path; application_uses_webconfig_files_for_secrets; webapplication_config_file_exposed_via_URL; secrets_and_keys_are_stored_in_configuration_file; secrets_are_stored_in_configuration_file; webserver_is_Apache_version_lteq_v2550; secrets_are_stored_in_configuration_file; application_uses_config_files_for_secrets; }
    }
    Secrets_extracted_from_app_binary -> Dont_publish_code_containing_secrets
    Secrets_extracted_from_app_binary -> Dont_publish_app_binary_containing_secrets
    Secrets_extracted_from_app_binary -> Dont_store_secrets_in_config_file
    secrets_are_stored_in_configuration_file -> Secrets_extracted_via_encoded_path_in_URL
    secrets_are_stored_in_configuration_file -> Secrets_extracted_via_encoded_path_in_URL_sent_to_Apache_Web_Server
    secrets_are_stored_in_configuration_file -> Webserver_shouldnt_serve_config_files
    secrets_are_stored_in_configuration_file -> Dont_allow_path_traversal_to_configuration_files
    webapplication_config_file_exposed_via_URL -> Secrets_extracted_via_webserver_path_traversal
    code_repo_access -> Secrets_extracted_from_code
    Secrets_extracted_via_encoded_path_in_URL -> Block_encoded_paths
    webapplication_uses_input_to_calculate_config_file_path -> Secrets_extracted_via_path_traversal
    app_binary_access -> Secrets_extracted_from_app_binary
    application_uses_config_files_for_secrets -> Dont_store_secrets_in_config_file
    reality -> webserver_is_vulnerable_to_path_traversal_via_encoded_URLs
    reality -> secrets_are_stored_in_configuration_file
    reality -> webserver_is_Apache_version_lteq_v2550
    reality -> Compromize_web_server
    reality -> code_repo_access
    reality -> app_binary_access
    reality -> webapplication_uses_input_to_calculate_config_file_path
    reality -> application_uses_webconfig_files_for_secrets
    reality -> webapplication_config_file_exposed_via_URL
    reality -> secrets_and_keys_are_stored_in_configuration_file
    reality -> Encrypt_secrets_before_storing_in_file
    reality -> Store_secrets_and_keys_in_vault
    reality -> application_uses_config_files_for_secrets
    Secrets_extracted_from_code -> Dont_publish_code_containing_secrets
    Secrets_extracted_from_code -> Dont_store_secrets_in_config_file
    Secrets_extracted_via_webserver_path_traversal -> Webserver_shouldnt_serve_config_files
    Secrets_extracted_via_webserver_path_traversal -> Dont_allow_path_traversal_to_configuration_files
    Secrets_extracted_via_encoded_path_in_URL_sent_to_Apache_Web_Server -> use_Apache_Web_Server_v2551_or_later
    application_uses_webconfig_files_for_secrets -> Secrets_extracted_via_path_traversal
    webserver_is_Apache_version_lteq_v2550 -> Secrets_extracted_via_encoded_path_in_URL_sent_to_Apache_Web_Server
    webserver_is_Apache_version_lteq_v2550 -> use_Apache_Web_Server_v2551_or_later
    webserver_is_vulnerable_to_path_traversal_via_encoded_URLs -> Secrets_extracted_via_encoded_path_in_URL
    secrets_and_keys_are_stored_in_configuration_file -> Secrets_extracted_via_webserver_path_traversal
    subgraph cluster_Attack_vault_that_stores_decryption_keys {
      label=<<B>Attack vault that<br></br>stores decryption keys</B>>
      graph[style="filled, rounded" rankdir="LR" splines="true" overlap="false" nodesep="0.2" ranksep="0.9" fontname="Arial"  fontsize="24"  fontcolor="black"  fillcolor="transparent"  color="gray" ];
      {rank="same"; }
    }
    subgraph cluster_Extract_access_tokens {
      label=<<B>Extract access<br></br>tokens</B>>
      graph[style="filled, rounded" rankdir="LR" splines="true" overlap="false" nodesep="0.2" ranksep="0.9" fontname="Arial"  fontsize="24"  fontcolor="black"  fillcolor="transparent"  color="gray" ];
      a_token_with_specific_rights_is_issued_to_a_client[label="a token with\nspecific rights is issued\nto a client"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      Dont_issue_tokenclones[label="Don't issue\ntoken-clones"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      Keep_tokens_only_in_transient_memory[label="Keep tokens only\nin transient memory"  shape="box3d"  style="filled, dashed"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="transparent"  color="blue"]
      Apply_same_level_of_protection_as_refresh_tokens_to_access_tokens[label="Apply same level\nof protection as\nrefresh tokens to access\ntokens"  shape="box3d"  style="filled, dashed"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="transparent"  color="blue"]
      Configure_token_to_expire_after_fixed_period_of_nouse[label="Configure token\nto expire after\nfixed period of no-use"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      Compromize_token_storage[label="Compromize token\nstorage"  shape="box3d"  style="filled, dashed"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="transparent"  color="red"]
      Exploit_token_with_wider_scope[label="Exploit token\nwith wider scope"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="red"  color="red"]
      a_leaked_access_token[label="a leaked access\ntoken"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="lightgray"  color="gray"]
      Limit_token_lifetime[label="Limit token\nlifetime"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      Keep_tokens_only_in_private_memory[label="Keep tokens only\nin private memory"  shape="box3d"  style="filled, dashed"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="black"  fillcolor="transparent"  color="blue"]
      limit_token_scope[label="limit token scope"  shape="box"  style="filled, rounded"  margin="0.2"  fontname="Arial"  fontsize="16"  fontcolor="white"  fillcolor="purple"  color="blue"]
      {rank="same"; a_leaked_access_token; a_token_with_specific_rights_is_issued_to_a_client; }
    }
    reality -> Compromize_token_storage
    reality -> a_leaked_access_token
    reality -> Keep_tokens_only_in_transient_memory
    reality -> Keep_tokens_only_in_private_memory
    reality -> Apply_same_level_of_protection_as_refresh_tokens_to_access_tokens
    reality -> a_token_with_specific_rights_is_issued_to_a_client
    a_leaked_access_token -> Exploit_token_with_wider_scope
    a_token_with_specific_rights_is_issued_to_a_client -> Dont_issue_tokenclones
    Exploit_token_with_wider_scope -> limit_token_scope
    Exploit_token_with_wider_scope -> Configure_token_to_expire_after_fixed_period_of_nouse
    Exploit_token_with_wider_scope -> Limit_token_lifetime
    Exploit_token_with_wider_scope -> Dont_issue_tokenclones
    Partial_URIs_are_considered_valid -> attacker_wins[ penwidth="4"  color="red" ]
    Embed_web_UI_component -> attacker_wins[ penwidth="4"  color="red" ]
    Secrets_extracted_from_code -> attacker_wins[ penwidth="4"  color="red" ]
    Secrets_extracted_via_path_traversal -> attacker_wins[ penwidth="4"  color="red" ]
  }
`