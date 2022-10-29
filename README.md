# tiledata
Provides an easy way of fetching map data as tiles from different sources. Relies on the browser environment and depends on proj4js for the moment. See the example index.html for more details.

## Usage
Import `tiledata.js` as a ES6 module. The core functions are `setConfig` and `getTiledata`.
First you have to initialize the module by calling `setConfig` which takes the following kind of options object:
```typescript
{
    sources: [{
        name: string,
        type: 'wmts' | 'wms',
        url: string, // With type 'wmts' the url shall contain substrings "{x}", "{y}", and "{z}" to be replaced with the corresponding coordinates.
        layers?: string, // Needed only when using wms.
        fetchOptions?: {}, // Passed onto the browser's fetch function.
        valueFunction: (r: number, g: number, b: number) => number
    }],
    tileSize?: number, // Defaults to 256
    saveDataByTile?: (name: string, data: any) => any,
    getDataByTile?: (name: string) => any
}
```
After which you're able to use the `getTiledata` function. Parameters are as follows:<br>
`tileCoords`: Object containing the x, y, and z coordinates for the desired tile.<br>
`sourceNames`: String array in which the strings point to previously defined sources by the name.<br>
For instance:
```typescript
getTiledata({ x: 1888, y: 2000 , z: 10 }, ['elevations'])
```
returns a Promise which resolves to
```typescript
{ elevations: Int16Array }
```


## example
Requires a `options.js` file in the folder. Template:
```javascript
export default {
  mapboxToken: 'VALID_TOKEN'
}
```

## TODO
- [ ] Add support for different typed array formats such as Float32.
