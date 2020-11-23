/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


BEE = {};
BEE.DELIMITER = '|';
BEE.NEWLINE = '$';
BEE.ColorModes = {
    RGB: "rgb",
    NORM: "norm",
    HEIGHT: "height",
    SOLID: "solid",
    INTENSITY: "intensity",
    LABEL: "label"
}

self.addEventListener('message', function (e) {
	// console.log('in here')
    // let tile3d = e.data.Tile3D;
	let projectID = e.data.projectID;
    let pointCloudID = e.data.pointCloudID;
    let boundingBox = e.data.boundingBox;
    let baseURL = e.data.baseURL;
    let offset = e.data.offset;
    let loaders = e.data.loaders;

	let baseUrl = baseURL + "/loadPoints?ProjectId="
		+ projectID + "&PclId=" + pointCloudID;
    // console.log(loader);
    let tileUnits = [];
    for (let key in loaders) {
        // console.log(loader[key]);
        // let params = {
        //     ProjectId: loader[key].ProjectId,
        //     PclId: loader[key].PclId,
        //     PartId: loader[key].PartId,
        //     Pos: loader[key].Pos,
        // };
        var req = new XMLHttpRequest();
        req.responseType = 'json';
        req.overrideMimeType("application/json");
		let url = baseUrl + "&PartId=" + loaders[key].PartId + "&Pos=" + loaders[key].Pos;
        req.open('GET', url, false);
        req.onload = function () {
            tileUnits.push(req.response);
            // do something with jsonResponse
        };

        try {
            req.send(null);
        } catch (e) {
            console.log(e);
        }
    }

	//TODO from global
	let ColorMode = null;
    let tile3d = parse(tileUnits, ColorMode, boundingBox, offset);
    // console.log(tile3d);
    self.postMessage(tile3d);
})

function parse(tileUnits, ColorMode, boundingBox, offset) {
    // console.log('boundingBox', boundingBox);
    let min = boundingBox.min;
    //console.log(res);
	ColorMode = {
		value: {
			r_col: 5,
			g_col: 6,
			b_col: 7
		}
	}
    let tile3d = {};
    tile3d.Attributes = [];
    tile3d.Positions = [];
    tile3d.Colors = [];
    tile3d.Normals = [];
    tile3d.Indices = [];

    let byte1 = 0;
    let byte2 = 0;
    let byte3 = 0;
    let byte4 = 0;

    for (let i = 0; i < tileUnits.length; i++) {
        let tileUnit = tileUnits[i];
        tile3d.Spacing = tileUnit.Spacing;
        if (!isNull(tileUnit.Data)){
            let tileData = tileUnit.Data.split('$');
            let particles = tileData.length;
            for (let j = 0; j < particles; j++) {
                let line = tileData[j].replaceAll('&', BEE.DELIMITER);
                let st = line.split(BEE.DELIMITER);
                if (st.length > 2 ) {
                    let x = Number(st[0]);
                    let y = Number(st[1]);
                    let z = Number(st[2]);

                    // console.log('x', x + x)
                    // console.log('y', y + y)
                    // console.log('z', z + z)
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z)){
                        let point = new Point3D(x - min.x - offset.x, y - min.y- offset.y, z - min.z- offset.z);
                        // let point = new Point3D(x - offset.x, y - offset.y, z - offset.z);
                        point.others = st.slice(3, st.length);
                        let color = getColor(ColorMode, point);
                        tile3d.Attributes.push(point.others);

                        if (!Number(st[4])) {
                            tile3d.Colors.push(120);
                            tile3d.Colors.push(20);
                            tile3d.Colors.push(59);
                        } else {
                            tile3d.Colors.push(Number(st[4]));
                            tile3d.Colors.push(Number(st[5]));
                            tile3d.Colors.push(Number(st[6]));
                        }
						tile3d.Colors.push(255);
                        tile3d.Positions.push(point.x);
                        tile3d.Positions.push(point.y);
                        tile3d.Positions.push(point.z);
                        // if (st.length === 10) {
                        //     tile3d.Normals.push(Number(st[7]));
                        //     tile3d.Normals.push(Number(st[8]));
                        //     tile3d.Normals.push(Number(st[9]));
                        // } else {
                        //     tile3d.Normals.push(1);
                        //     tile3d.Normals.push(1);
                        //     tile3d.Normals.push(1);
                        // }
                        tile3d.Indices.push(byte1);
                        tile3d.Indices.push(byte2);
                        tile3d.Indices.push(byte3);
                        tile3d.Indices.push(byte4);
                        
                        //TODO: change it to bitwise
                        if (byte1 >= 255) {
                            byte1 = 0;

                            if (byte2 >= 255) {
                                byte2 = 0;
                                
                                if (byte3 >= 255) {
                                    byte3 = 0;

                                    if (byte4 >= 255) {
                                        byte4 = 0;
                                        
                                    } else {
                                        byte4 ++;
                                    }
                                } else {
                                    byte3 ++;
                                }   
                            } else {
                                byte2 ++;
                            }
                        } else {
                            byte1 ++;
                        }
                    }
                }
            }
        } else {
            console.log(tileUnit);
        }
    }

    tile3d.Quantity = tile3d.Attributes.length;
    tile3d.Positions = new Float32Array(tile3d.Positions);
    tile3d.Colors = new Uint8Array(tile3d.Colors);
    tile3d.Normals = new Float32Array(tile3d.Normals);
    tile3d.Indices = new Uint8Array(tile3d.Indices)

    return tile3d;
}

//Check if variable is null
function isNull(obj) {
    if (obj === "null" || obj === "" || obj === null || obj === "undefined" || obj === undefined) {
        return true;
    } else {
        return false;
    }
}

//Point object
var Point3D = function (x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.others;
}

//Rect3D object
var Rect3D = function (x1, y1, z1, x2, y2, z2) {
    this.min = new Point3D(x1, y1, z1);
    this.max = new Point3D(x2, y2, z2);
}

String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

function getColor(ColorMode, point) {
    let color = {r: 1, g: 1, b: 1};

	let r_col = ColorMode.value.r_col - 3 - 1;
	let g_col = ColorMode.value.g_col - 3 - 1;
	let b_col = ColorMode.value.b_col - 3 - 1;
	if (!isNull(point.others) && point.others.length >= 2) {
		let r = Number(point.others[r_col]) / 255;
		let g = Number(point.others[g_col]) / 255;
		let b = Number(point.others[b_col]) / 255;
		r = r <= 1.0 ? r : r / 256;
		g = g <= 1.0 ? g : g / 256;
		b = b <= 1.0 ? b : b / 256;
		color = {r: r, g: g, b: b};
	}

	return color;

    //Real Time Coloring
    switch (ColorMode.type) {
        case BEE.ColorModes.SOLID:
            // code block
            color = ColorMode.value;
            break;
        case BEE.ColorModes.HEIGHT:
            // code block
            let step = (ColorMode.value.maxheight - ColorMode.value.minheight) / ColorMode.value.rangecolor.length;
            let height = point.z;

            if (height >= ColorMode.value.minheight && height < ColorMode.value.maxheight) {

                let indexcolor = Math.ceil((height - ColorMode.value.minheight) / step);

                color = hexToRgb(ColorMode.value.rangecolor[indexcolor], 255);

                break;
            }


        case BEE.ColorModes.RGB:
            // code block
            let r_col = ColorMode.value.r_col - 3 - 1;
            let g_col = ColorMode.value.g_col - 3 - 1;
            let b_col = ColorMode.value.b_col - 3 - 1;
            if (!isNull(point.others) && point.others.length >= 2) {
                let r = Number(point.others[r_col]) / 255;
                let g = Number(point.others[g_col]) / 255;
                let b = Number(point.others[b_col]) / 255;
                r = r <= 1.0 ? r : r / 256;
                g = g <= 1.0 ? g : g / 256;
                b = b <= 1.0 ? b : b / 256;
                color = {r: r, g: g, b: b};
            }
            break;
        case BEE.ColorModes.NORM:
            // code block
            let xn_col = ColorMode.value.xn_col - 3 - 1;
            let yn_col = ColorMode.value.yn_col - 3 - 1;
            let zn_col = ColorMode.value.zn_col - 3 - 1;
            if (!isNull(point.others)) {
                if (point.others.length >= 2) {
                    let r = Number(point.others[xn_col]) * 0.5 + 0.5;
                    let g = Number(point.others[yn_col]) * 0.5 + 0.5;
                    let b = Number(point.others[zn_col]) * 0.5 + 0.5;
                    color = {r: r, g: g, b: b};
                }
            }
            break;
        case BEE.ColorModes.INTENSITY:
            // code block
            if (!isNull(point.attributes)) {
                let i_col = ColorMode.value.i_col - 3 - 1;
                let minI = ColorMode.value.minI;
                let maxI = ColorMode.value.maxI;
                if (point.attributes.length > i_col) {
                    let ivalue = Number(point.attributes[i_col]);
                    let indexcolor = Math.ceil((ivalue - minI) * (255 - 0)) / (maxI - minI);
                    color = hexToRgb(ColorMode.value.rangecolor[indexcolor], 255);
                }
            }
            break;
        case BEE.ColorModes.LABEL:
            // code block
            if (!isNull(point.attributes)) {
                let l_col = ColorMode.value.l_col - 3 - 1;
                if (point.attributes.length > l_col) {
                    let lvalue = Number(point.attributes[l_col]);
                    if (!ColorMode.value.colorSet.hasOwnProperty(lvalue)) {
                        ColorMode.value.colorSet[lvalue] = getRandomColor();
                    }
                    color = hexToRgb(ColorMode.value.colorSet[lvalue], 255);
                }
            }
            break;
        default:
        // code block
    }

    return color;
}

function hexToRgb(hex, scale) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / scale,
        g: parseInt(result[2], 16) / scale,
        b: parseInt(result[3], 16) / scale
    } : {r: 255, g: 255, b: 255};
}

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

