//selecting all required elements
const dropArea = document.querySelector(".drag-area"),
    dragText = dropArea.querySelector("header"),
    button = dropArea.querySelector("button"),
    input = dropArea.querySelector("input");


let file; //this is a global variable and we'll use it inside multiple functions

button.onclick = () => {
    input.click(); //if user click on the button then the input also clicked
}

input.addEventListener("change", function () {
    //getting user select file and [0] this means if user select multiple files then we'll select only the first one
    file = this.files[0];
    dropArea.classList.add("active");
    showFile(); //calling function
});
//If user Drag File Over DropArea
dropArea.addEventListener("dragover", (event) => {
    event.preventDefault(); //preventing from default behaviour
    dropArea.classList.add("active");
    dragText.textContent = "Release to Upload File";
});

//If user leave dragged File from DropArea
dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("active");
    dragText.textContent = "Drag & Drop to Upload File";
});

//If user drop File on DropArea
dropArea.addEventListener("drop", (event) => {
    event.preventDefault(); //preventing from default behaviour
    //getting user select file and [0] this means if user select multiple files then we'll select only the first one
    file = event.dataTransfer.files[0];
    showFile(); //calling function
});

function showFile() {
    if (file.type === 'text/csv') {
        document.getElementById("QrCodes").innerHTML = ""
        let fileReader = new FileReader();
        fileReader.onload = (event) => {
            var csvData = event.target.result;

            document.getElementById("downloadQRCodes").style.display = "block"
            document.getElementById("QrCodes").appendChild(showCSVasTable(csvData))
            contacts = parseCSV(csvData);

            ContactsLoaded(contacts)
        }
        fileReader.readAsText(file);
    } else {
        alert("This is not an CSV File!");
        dropArea.classList.remove("active");
        dragText.textContent = "Drag & Drop to Upload File";
    }
}

downloadQRCodesBTN = document.getElementById("downloadQRCodesBTN")
downloadQRCodesBTN.onclick = () => {
    downloadImages(imgIds)
}
async function downloadImages(imageUrls) {
    try {
        for (let i = 0; i < imageUrls.length; i++) {const imgTagid = imageUrls[i];
            const imgTag = document.getElementById(imgTagid);
            const src = imgTag.getAttribute('src');
            
            // Create a new image element
            const img = new Image();
            img.src = src;
            
            // Wait for the image to load
            img.onload = function() {
              // Create a canvas element
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
            
              // Draw the image on the canvas
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
            
              // Convert the canvas content to a data URL (PNG format)
              const dataUrl = canvas.toDataURL('image/png');
            
              // Create a download link
              const link = document.createElement('a');
              link.href = dataUrl;
              link.download = imgTag.id + '.png';
            
              // Simulate a click to trigger the download
              link.click();
            };
            

            // Introduce a delay of 1 second between each download
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('All images downloaded successfully!');
    } catch (error) {
        console.error('Error occurred while downloading images:', error);
    }
}

// function downloadImages(imgTags) {
//     imgTags.forEach((imgTagid) => {
//         imgTag = document.getElementById(imgTagid)
//         var src = imgTag.getAttribute('src');
//         // if (src) {
//         var link = document.createElement('a');
//         link.href = src;
//         link.download = imgTag.id;
//         document.body.appendChild(link);
//         link.click();
//         document.body.removeChild(link);
//         // }
//     });
// }

function ContactsLoaded(contacts) {
    contacts.forEach((contact, contactIndex) => {
        id = imgIds[contactIndex]
        download_image(VcardURL(contact), id)
    });
}

function parseCSV(csvData) {
    var rows = csvData.split("\n");
    var headers = rows[0].split(",");
    var data = [];

    for (var i = 1; i < rows.length; i++) {
        var row = rows[i].split(",");
        if (row.length === headers.length) {
            var rowData = {};
            for (var j = 0; j < headers.length; j++) {
                rowData[headers[j].trim()] = row[j].trim();
            }
            data.push(rowData);
        }
    }

    return data;
}

imgIds = []
function showCSVasTable(csvContent) {
    // Split the CSV content into rows
    var rows = csvContent.split("\n");

    // Create the table element
    var table = document.createElement("table");

    // Process each row
    rows.forEach(function (row, rowIndex) {
        // Split the row into cells
        var cells = row.split(",");
        // Create a table row element
        var tableRow = document.createElement("tr");

        let name = ""
        if (rowIndex > 0) {
            name = cells[0] + cells[4]
        }

        // Process each cell
        cells.forEach(function (cell, cellIndex) {
            // Format the cell content of the first row
            if (rowIndex === 0) {
                // Replace underscores with spaces
                var formattedCell = cell.replace(/_/g, " ");

                // Capitalize the first letter of every word
                formattedCell = formattedCell.replace(/\b\w/g, function (match) {
                    return match.toUpperCase();
                });

                // Set the formatted cell content
                cell = formattedCell;
            }

            // Create a table cell element
            var tableCell = document.createElement(rowIndex === 0 ? "th" : "td");

            // Set the cell content
            var cellText = document.createTextNode(cell);
            tableCell.appendChild(cellText);

            // Add the cell to the row
            tableRow.appendChild(tableCell);

            // Create an image tag with unique ID and blank source
            if (cellIndex === cells.length - 1 && rowIndex == 0) {
                // Create a table cell element
                var tableCell = document.createElement(rowIndex === 0 ? "th" : "td");

                var cellText = document.createTextNode("QR Code");
                tableCell.appendChild(cellText);

                // Add the cell to the row
                tableRow.appendChild(tableCell);
            }

            // Create an image tag with unique ID and blank source
            if (cellIndex === cells.length - 1 && rowIndex > 0) {
                // Create a table cell element
                var tableCell = document.createElement(rowIndex === 0 ? "th" : "td");

                var image = document.createElement("img");
                var uniqueId = name + "_QRCode";
                imgIds.push(uniqueId)
                console.log(imgIds)
                image.setAttribute("id", uniqueId);
                image.setAttribute("src", "");
                image.style.width="100px"
                tableCell.appendChild(image);

                // Add the cell to the row
                tableRow.appendChild(tableCell);
            }

        });

        // Add the row to the table
        table.appendChild(tableRow);
    });

    // Return the table
    return table;
}
