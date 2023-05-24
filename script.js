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
        let fileReader = new FileReader();
        fileReader.onload = (event) => {
            var csvData = event.target.result;
            // Do something with the CSV data
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

function ContactsLoaded(contacts) {
    contacts.forEach(contact => {
        id = contact.first_name + "img"
        document.getElementById("QrCodes").innerHTML += '<table><tbody><tr><td>' + contact.first_name + " " + contact.last_name + '</td><td><img id="' + id + '" src=""></tr></td></tbody></table>'
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
