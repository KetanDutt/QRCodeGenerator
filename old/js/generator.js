function download_image(url, id) {
    fetch(url)
        .then(res => { return res.blob() })
        .then(blob => {
            var img = URL.createObjectURL(blob);
            // Do whatever with the img
            document.getElementById(id).setAttribute('src', img);
        })
}

function VcardURL(contact) {
    url = "https://quickchart.io/qr?size=1000&text=BEGIN%3AVCARD%0AVERSION%3A3.0%0AN%3A" + contact["Last Name"] + "%3B" + contact["First Name"] +
        "%0AN%3A" + contact["First Name"] + "%20" + contact["Last Name"] + "%0AORG%3A" + "RTC Tek" + "%0ATITLE%3A" + contact["Designation"] +
        "%0AADR%3A%3B%3B" + "" + "%3B" + "" + "%3B" + "" + "%3B" + "" + "%3B" + "India" + "%0ATEL%3BWORK%3BVOICE%3A" + contact["Employee Contact Number"] +
        "%0ATEL%3BCELL%3A" + contact["Emergency Contact Number (Should not be same as employee contact number)"] + "%0ATEL%3BFAX%3A%0AEMAIL%3BWORK%3BINTERNET%3A" + contact["Official Email ID"] + "%0AURL%3A" + "" + "%0AEND%3AVCARD"
    return url


    // url = "https://quickchart.io/qr?text=BEGIN%3AVCARD%0AVERSION%3A3.0%0AN%3A" + contact["Last Name"] + "%3B" + contact["First Name"] +
    //     "%0AN%3A" + contact["First Name"] + "%20" + contact["Last Name"] + "%0AORG%3A" + "RTC Tek" + "%0ATITLE%3A" + contact["Designation"] +
    //     "%0AADR%3A%3B%3B" + contact.home_street + "%3B" + contact.home_city + "%3B" + contact.home_region + "%3B" + contact.home_post + "%3B" + contact.home_country + "%0ATEL%3BWORK%3BVOICE%3A" + contact["Employee Contact Number"] +
    //     "%0ATEL%3BCELL%3A" + contact["Emergency Contact Number (Should not be same as employee contact number)"] + "%0ATEL%3BFAX%3A%0AEMAIL%3BWORK%3BINTERNET%3A" + contact["Official Email ID"] + "%0AURL%3A" + contact.homepage + "%0AEND%3AVCARD"
    // return url
}
