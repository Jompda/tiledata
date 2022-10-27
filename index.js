import options from './options.js'


import { setConfig, getTopodataByTile, pointToTileCoords, wmsGetMapTile, getImage, xyPositionOnTile } from './topodata.js'


const tileDataStorage = new Map()
setConfig({
    saveDataByTile: (name, data) => {
        tileDataStorage.set(name, data)
    },
    getDataByTile: (name) => tileDataStorage.get(name)
})


//const projectedLatLng = proj4('EPSG:3857', 'EPSG:4326').forward([2808285, 9608542])
//const latlng = { lat: projectedLatLng[0], lng: projectedLatLng[1] }
const latlng1 = { lat: 22, lng: 60 }
const latlng2 = { lat: 30, lng: 69 }

doStuff()
async function doStuff() {
    const z = 8
    const dLat = latlng2.lat - latlng1.lat
    const dLng = latlng2.lng - latlng1.lng
    for (let i = 0; i < 5; i++) {
        const latlng = {
            lat: latlng1.lat + Math.random() * dLat,
            lng: latlng1.lng + Math.random() * dLng
        }
        //const treeHeight = await wmsLatLngTreeHeight(latlng)
        /*console.table([
            ['latlng', 'zoom', 'elevation', 'tree height'],
            [(Math.round(latlng.lat * 100) / 100) + ', ' + (Math.round(latlng.lng * 100) / 100), z, undefined, treeHeight]
        ])*/
        await appendImage(latlng, z)
    }
}
async function appendImage(latlng, zoom = 0) {
    const point = proj4('EPSG:4326', 'EPSG:3857').forward([latlng.lat, latlng.lng])

    const tileCoords = pointToTileCoords({ x: point[0], y: point[1], z: zoom })
    //console.log('tileCoords', tileCoords)

    const xyOnTile = xyPositionOnTile(latlng, zoom)
    console.log('xyOnTile', xyOnTile)

    const result = await getTopodataByTile(tileCoords, {
        elevation: true,
        treeHeight: true
    })
    //console.log(result)
    console.table([
        ['lat, lng', 'zoom', 'elevation', 'tree height'],
        [latlng.lat + ', ' + latlng.lng, zoom, result.elevation[xyOnTile.y * 256 + xyOnTile.x], result.treeHeight[xyOnTile.y * 256 + xyOnTile.x]]
    ])



    // Just for visualizing the data
    const treeHeights = await wmsGetMapTile(tileCoords)
    const terrainRGB = await getImage(
        `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw?access_token=${options.mapboxToken}`
            .replace('{z}', tileCoords.z)
            .replace('{x}', tileCoords.x)
            .replace('{y}', tileCoords.y)
    )
    const osm = await getImage(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            .replace('{z}', tileCoords.z)
            .replace('{x}', tileCoords.x)
            .replace('{y}', tileCoords.y)
    )

    const s = 8
    const putpixel = (ctx, x, y) => ctx.fillRect(x - s / 2, y - s / 2, s, s)

    let canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    let ctx = canvas.getContext('2d')
    ctx.drawImage(osm, 0, 0)
    ctx.fillStyle = 'red'
    putpixel(ctx, xyOnTile.x, xyOnTile.y)
    document.getElementById('r1').appendChild(canvas)

    canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    ctx = canvas.getContext('2d')
    ctx.drawImage(terrainRGB, 0, 0)
    ctx.fillStyle = 'red'
    putpixel(ctx, xyOnTile.x, xyOnTile.y)
    document.getElementById('r2').appendChild(canvas)

    canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    ctx = canvas.getContext('2d')
    ctx.drawImage(treeHeights, 0, 0)
    ctx.fillStyle = 'red'
    putpixel(ctx, xyOnTile.x, xyOnTile.y)
    document.getElementById('r3').appendChild(canvas)
}




/**
 * Title: Bresenham's line algorithm
 * Author: Jack Elton Bresenham
 * Date: 22.10.2022
 * Source: https://en.wikipedia.org/wiki/Bresenham's_line_algorithm
 */
function getLinePlot(x0, y0, x1, y1) {
    const gridPoints = []

    const dx = Math.abs(x1 - x0)
    const sx = x0 < x1 ? 1 : -1
    const dy = -Math.abs(y1 - y0)
    const sy = y0 < y1 ? 1 : -1
    let error = dx + dy

    while (true) {
        gridPoints.push({ x: x0, y: y0 })
        if (x0 == x1 && y0 == y1) break
        const e2 = 2 * error
        if (e2 >= dy) {
            if (x0 == x1) break
            error = error + dy
            x0 = x0 + sx
        }
        if (e2 <= dx) {
            if (y0 == y1) break
            error = error + dx
            y0 = y0 + sy
        }
    }

    return gridPoints
}