
// RGBA-data: ctx.getImageData(0, 0, w, h).data

doStuff()
async function doStuff() {
    await appendImage()
    await appendImage(256)
}
async function appendImage(xOffset = 0, yOffset = 0) {
    const cs = 16
    const w = 256, h = 256
    const x0 = 308000 + xOffset * cs, y0 = 6666000 + yOffset * cs, x1 = x0 + w * cs, y1 = y0 + h * cs
    const result = await wmsGetMap('https://kartta.luke.fi/geoserver/MVMI/ows?', {
        layers: 'keskipituus_1519', srs: 'EPSG:3067', x0, y0, x1, y1, w, h, format: 'image/png'
    })
    console.log(result)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(result, 0, 0)
    document.body.appendChild(canvas)
}

//https://kartta.luke.fi/geoserver/MVMI/ows?service=WMS&request=GetMap&version=1.3.0&layers=keskipituus_1519&srs=EPSG:3067&bbox=308000,6666000,312096,6670096&width=256&height=256&format=image/png
function wmsGetMap(url, {
    version = '1.3.0', layers, srs = 'EPSG:3857', x0, y0, x1, y1, w, h, format = 'image/png'
}, fetchOptions) {
    return new Promise((resolve, reject) => {
        const imgUrl = url + (url[url.length - 1] == '?' ? '' : '?') +
            `service=WMS&` +
            `request=GetMap&` +
            `version=${version}&` +
            `layers=${layers}&` +
            `srs=${srs}&` +
            `bbox=${x0},${y0},${x1},${y1}&` +
            `width=${w}&` +
            `height=${h}&` +
            `format=${format}`
        fetch(imgUrl, fetchOptions)
            .then(response => response.blob())
            .then(blob => {
                const blobUrl = URL.createObjectURL(blob)
                let img = new Image()
                img.crossOrigin = '*'
                img.onload = () => resolve(img)
                img.onerror = reject
                img.src = blobUrl
            })
    })
}
