import {BeagleMetadata} from "./BeagleMetadata.js";
import {BeagleNode} from "./BeagleNode.js";

import {Version} from "../../../Version.js";
import {XHRFactory} from "../../../XHRFactory.js";
import {BeaglePointsLoader} from "./BeaglePointsLoader.js";
import {Utils} from "../../../utils.js";
import {PointAttribute, PointAttributes, PointAttributeTypes} from "../../../loader/PointAttributes.js";

function parseAttributes(cloudjs){

	let version = new Version(cloudjs.version);

	const replacements = {
		"COLOR_PACKED": "rgba",
		"RGBA": "rgba",
		"INTENSITY": "intensity",
		"CLASSIFICATION": "classification",
	};

	const replaceOldNames = (old) => {
		if(replacements[old]){
			return replacements[old];
		}else{
			return old;
		}
	};

	const pointAttributes = [];
	if(version.upTo('1.7')){
		
		for(let attributeName of cloudjs.pointAttributes){
			const oldAttribute = PointAttribute[attributeName];

			const attribute = {
				name: oldAttribute.name,
				size: oldAttribute.byteSize,
				elements: oldAttribute.numElements,
				elementSize: oldAttribute.byteSize / oldAttribute.numElements,
				type: oldAttribute.type.name,
				description: "",
			};

			pointAttributes.push(attribute);
		}

	}else{
		pointAttributes.push(...cloudjs.pointAttributes);
	}


	{
		const attributes = new PointAttributes();

		const typeConversion = {
			int8:   PointAttributeTypes.DATA_TYPE_INT8,
			int16:  PointAttributeTypes.DATA_TYPE_INT16,
			int32:  PointAttributeTypes.DATA_TYPE_INT32,
			int64:  PointAttributeTypes.DATA_TYPE_INT64,
			uint8:  PointAttributeTypes.DATA_TYPE_UINT8,
			uint16: PointAttributeTypes.DATA_TYPE_UINT16,
			uint32: PointAttributeTypes.DATA_TYPE_UINT32,
			uint64: PointAttributeTypes.DATA_TYPE_UINT64,
			double: PointAttributeTypes.DATA_TYPE_DOUBLE,
			float:  PointAttributeTypes.DATA_TYPE_FLOAT,
		};

		for(const jsAttribute of pointAttributes){
			const name = replaceOldNames(jsAttribute.name);
			const type = typeConversion[jsAttribute.type];
			const numElements = jsAttribute.elements;
			const description = jsAttribute.description;

			const attribute = new PointAttribute(name, type, numElements);

			attributes.add(attribute);
		}

		{
			// check if it has normals
			let hasNormals = 
				pointAttributes.find(a => a.name === "NormalX") !== undefined &&
				pointAttributes.find(a => a.name === "NormalY") !== undefined &&
				pointAttributes.find(a => a.name === "NormalZ") !== undefined;

			if(hasNormals){
				let vector = {
					name: "NORMAL",
					attributes: ["NormalX", "NormalY", "NormalZ"],
				};
				attributes.addVector(vector);
			}
		}

		return attributes;
	}

}


export class BeagleLoader {

	static load(url, callback){
		try {
			let metadata = new BeagleMetadata();
			metadata.url = url;
			let xhr = XHRFactory.createXMLHttpRequest();
			xhr.open('GET', url, true);

			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 0)) {
					let response = JSON.parse(xhr.responseText);

					let version = new Version(response.version);
					metadata.version = version;
					metadata.spacing = response.spacing;
					metadata.hierarchyStepSize = response.hierarchyStepSize;

					metadata.attributes = parseAttributes(response);
					{
						let params = metadata.url.split('?')[1].split('&')

						for (let i = 0; i < params.length; i++) {
							let item = params[i]
							let value = item.split('=')[1]
							if (item.startsWith('project-id')) {
								metadata.projectID = value;
							} else if (item.startsWith('point-cloud-id')) {
								metadata.pointCloudID = value;
							}
						}
					}
					metadata.baseURL = metadata.url.split("/potree")[0]

					let min = new THREE.Vector3(response.boundingBox.lx, response.boundingBox.ly, response.boundingBox.lz);
					let max = new THREE.Vector3(response.boundingBox.ux, response.boundingBox.uy, response.boundingBox.uz);
					

					let delta_x = response.boundingBox.ux - response.boundingBox.lx
					let delta_y = response.boundingBox.uy - response.boundingBox.ly
					let delta_z = response.boundingBox.uz - response.boundingBox.lz

					let max_delta = Math.max(delta_x, delta_y, delta_z)
					
					max = new THREE.Vector3(min.x + max_delta, min.y + max_delta, min.z + max_delta);

					// min = new THREE.Vector3(0, 0, 0);

					let boundingBox = new THREE.Box3(min, max);
					let tightBoundingBox = boundingBox.clone();

					// if (response.tightBoundingBox) {
					// 	tightBoundingBox.min.copy(new THREE.Vector3(response.tightBoundingBox.lx, response.tightBoundingBox.ly, response.tightBoundingBox.lz));
					// 	tightBoundingBox.max.copy(new THREE.Vector3(response.tightBoundingBox.ux, response.tightBoundingBox.uy, response.tightBoundingBox.uz));
					// }

					// let offset = min.clone();

					// boundingBox.min.sub(offset);
					// boundingBox.max.sub(offset);

					// tightBoundingBox.min.sub(offset);
					// tightBoundingBox.max.sub(offset);

					metadata.projection = response.projection;
					metadata.boundingBox = boundingBox;
					metadata.tightBoundingBox = tightBoundingBox;
					metadata.boundingSphere = boundingBox.getBoundingSphere(new THREE.Sphere());
					metadata.tightBoundingSphere = tightBoundingBox.getBoundingSphere(new THREE.Sphere());
					metadata.offset = new THREE.Vector3(0, 0, 0);
					
					metadata.loader = new BeaglePointsLoader(response.version, metadata);
					metadata.pointAttributes = parseAttributes(response);

					let nodes = {};

					{ // load root
						let name = 'r';
						let root = new BeagleNode(name, metadata);
						root.level = 0;
						root.hasChildren = true;
						root.spacing = metadata.spacing;
						root.numPoints = 0;
						root.boundingBox = metadata.boundingBox;
						root.boundingSphere = metadata.boundingSphere;
						root.tightBoundingBox = metadata.boundingBox;
						root.tightBoundingSphere = metadata.boundingSphere;
						metadata.root = root;
						metadata.root.load();
						nodes[name] = root;
						// console.log('root', root)
					}

					

					metadata.nodes = nodes;

					// console.log('metadata', metadata);

					callback(metadata);
				}
			};

			xhr.send(null);
		} catch (e) {
			// console.log("loading failed: '" + url + "'");
			// console.log(e);

			callback();
		}
	}

	loadPointAttributes(mno){
		let fpa = mno.pointAttributes;
		let pa = new PointAttributes();

		for (let i = 0; i < fpa.length; i++) {
			let pointAttribute = PointAttribute[fpa[i]];
			pa.add(pointAttribute);
		}

		return pa;
	}

	createChildAABB(aabb, index){
		let min = aabb.min.clone();
		let max = aabb.max.clone();
		let size = new THREE.Vector3().subVectors(max, min);

		if ((index & 0b0001) > 0) {
			min.z += size.z / 2;
		} else {
			max.z -= size.z / 2;
		}

		if ((index & 0b0010) > 0) {
			min.y += size.y / 2;
		} else {
			max.y -= size.y / 2;
		}

		if ((index & 0b0100) > 0) {
			min.x += size.x / 2;
		} else {
			max.x -= size.x / 2;
		}

		return new THREE.Box3(min, max);
	}
}

