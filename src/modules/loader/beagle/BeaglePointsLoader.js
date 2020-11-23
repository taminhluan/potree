/**
 * @author luantm
 */
import {Version} from "../../../Version.js";
import {XHRFactory} from "../../../XHRFactory.js";


export class BeaglePointsLoader {
	constructor(version, metadata) {
		if (typeof (version) === 'string') {
			this.version = new Version(version);
		} else {
			this.version = version;
		}

		this.metadata = metadata;
	}

	load(node){
		// console.log('BeaglePointsLoader: load');
		// console.log('node', node);
		
		if (node.loaded) {
			return;
		}

		// let workerPath = Potree.scriptPath + '/workers/BinaryDecoderWorker.js';
		let workerPath = Potree.scriptPath +'/workers/beagle/BeagleLoadPointsWorker.js';
		let worker = Potree.workerPool.getWorker(workerPath);

		worker.onmessage = function (e) {
			// console.log('e.data', e.data);

			let data = e.data;
			// let tightBoundingBox = new THREE.Box3(
			// 	new THREE.Vector3().fromArray(node.tightBoundingBox.min),
			// 	new THREE.Vector3().fromArray(node.tightBoundingBox.max)
			// );

			Potree.workerPool.returnWorker(workerPath, worker);

			let geometry = new THREE.BufferGeometry();
            // geometry.name = this.name  + "_geometry";
            // geometry.attrs = e.data.Attributes;
            geometry.addAttribute('position', new THREE.BufferAttribute(e.data.Positions, 3));
			geometry.addAttribute('rgba', new THREE.BufferAttribute(e.data.Colors, 4, true));
			geometry.addAttribute('indices', new THREE.BufferAttribute(e.data.Indices, 4));
			geometry.attributes.indices.normalized = true;
			// geometry.offset = node.metadata.offset;


			// geometry.addAttribute('offset', )
            // geometry.addAttribute('norm', new THREE.BufferAttribute(e.data.Normals, 3));


			// tightBoundingBox.max.sub(tightBoundingBox.min);
			// tightBoundingBox.min.set(0, 0, 0);

			let numPoints = data.Quantity;
			
			node.numPoints = numPoints;
			node.geometry = geometry;
			// node.mean = new THREE.Vector3(...data.mean);
			// node.tightBoundingBox = tightBoundingBox;
			node.loaded = true;
			node.loading = false;
			node.spacing = data.Spacing;
			// node.estimatedSpacing = data.estimatedSpacing;

			Potree.numNodesLoading--;
		};

		let message = {
			projectID: node.metadata.projectID,
			pointCloudID: node.metadata.pointCloudID,
			loaders: node.loaders,
			boundingBox: node.boundingBox,
			baseURL: node.metadata.baseURL,
			offset: node.metadata.offset
		}
		worker.postMessage(message);
	};
}

