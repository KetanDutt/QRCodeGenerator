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
    url = "https://quickchart.io/qr?text=BEGIN%3AVCARD%0AVERSION%3A3.0%0AN%3A" + contact.last_name + "%3B" + contact.first_name +
        "%0AN%3A" + contact.first_name + "%20" + contact.last_name + "%0AORG%3A" + contact.company_name + "%0ATITLE%3A" + contact.position +
        "%0AADR%3A%3B%3B" + contact.home_street + "%3B" + contact.home_city + "%3B" + contact.home_region + "%3B" + contact.home_post + "%3B" + contact.home_country + "%0ATEL%3BWORK%3BVOICE%3A" + contact.phone_no +
        "%0ATEL%3BCELL%3A" + contact.emergency_no + "%0ATEL%3BFAX%3A%0AEMAIL%3BWORK%3BINTERNET%3A" + contact.email + "%0AURL%3A" + contact.homepage + "%0AEND%3AVCARD"
    return url
}