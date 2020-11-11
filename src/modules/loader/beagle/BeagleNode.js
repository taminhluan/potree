import {PointCloudTreeNode} from "../../../PointCloudTree.js";
import {XHRFactory} from "../../../XHRFactory.js";
import {Utils} from "../../../utils.js";

export class BeagleNode extends PointCloudTreeNode {

	constructor(name, metadata){
		super();

		this.id = BeagleNode.IDCount++;
		this.name = name;
		this.index = parseInt(name.charAt(name.length - 1));
		this.metadata = metadata;
		this.geometry = metadata;
		this.boundingBox = null;
		this.boundingSphere = null;
		this.children = {};
		this.numPoints = 0;
		this.level = null;
		this.loaded = false;
		this.oneTimeDisposeHandlers = [];
	}

	isGeometryNode(){
		return true;
	}

	getLevel(){
		return this.level;
	}

	isTreeNode(){
		return false;
	}

	isLoaded(){
		return this.loaded;
	}

	getBoundingSphere(){
		return this.boundingSphere;
	}

	getBoundingBox(){
		return this.boundingBox;
	}

	getChildren(){
		let children = [];

		for (let i = 0; i < 8; i++) {
			if (this.children[i]) {
				children.push(this.children[i]);
			}
		}

		return children;
	}

	getBoundingBox(){
		return this.boundingBox;
	}

	getURL(){
		let url = '';

		return url;
	}

	getHierarchyPath(){
		let path = 'r/';

		let hierarchyStepSize = this.metadata.hierarchyStepSize;
		let indices = this.name.substr(1);

		let numParts = Math.floor(indices.length / hierarchyStepSize);
		for (let i = 0; i < numParts; i++) {
			path += indices.substr(i * hierarchyStepSize, hierarchyStepSize) + '/';
		}

		path = path.slice(0, -1);

		return path;
	}

	addChild(child) {
		this.children[child.index] = child;
		child.parent = this;
	}

	load(){
		if (this.loading === true || this.loaded === true || Potree.numNodesLoading >= Potree.maxNodesLoading) {
			return;
		}

		this.loading = true;

		Potree.numNodesLoading++;

		if ((this.level % this.metadata.hierarchyStepSize) === 0 && this.hasChildren && ! this.loadedTree) {
			this.loadHierachyThenPoints();
		} else {
			this.loadPoints();
		}
	}

	loadPoints(){
		// console.log('BeagleNode: loadPoints');
		this.metadata.loader.load(this);
	}

	loadHierachyThenPoints(){
		// console.log('BeagleNode: loadHierachyThenPoints');
		let node = this;

		// load hierarchy
		let callback = function (node, response) {
			// console.log('BeagleNode: loadHierarchy. callback');
			// console.log('response', response);
			// console.log('version', node.metadata.version)

			let tStart = performance.now();
			//TODO: calculate node.boundingBox

			let children = [];
			let spacing = 0;
			

			let version = node.metadata.version;

			if (version.equalOrHigher("1.5")) {
				let group = response[node.name]
				if (!group) {
					return;
				}

				let loaders = group.ls;
				node.loaders = {}
				for (let i = 0; i < loaders.length; i++) {
					let loader = loaders[i];
					// poct.Quantity = loader.q;
					node.loaders[i] = {
						PartId: group.p,
						Pos: loader.p
					};
				}
				children = group.cs;
			} else {
				node.loaders = response;
				// console.log('loaders', response)
				for (let key in response) {
					response[key].ChildIds.split('|').forEach(item => {
						if (! children.includes(item)) {
							children.push(item)
						}
					})
					spacing = response[key].Spacing;
				}
			}
			let count = 0;
			for (let k = 0; k < children.length; k++) {
				if (children[k]) {
					count++;
					let childName = node.name + "" + children[k]
					let child = new BeagleNode(childName, node.metadata);

					child.level = child.name.length;
					let boundingBox = Utils.createChildAABB(node.boundingBox, children[k]);
					child.boundingBox = boundingBox
					child.boundingSphere = boundingBox.getBoundingSphere(new THREE.Sphere())
					child.tightBoundingBox = child.boundingBox
					child.tightBoundingSphere = child.boundingSphere
					node.spacing = spacing;
					child.hasChildren = true;

					node.addChild(child);
				}
			}
			if (count === 0) {
				node.hasChildren = false;
			} else {
				node.hasChildren = true;
			}
			node.loadedTree = true

			let duration = performance.now() - tStart;
			if(duration > 5){
				let msg = `duration: ${duration}ms, numNodes`;
			}

			node.loadPoints();
		};

		if ((node.level % node.metadata.hierarchyStepSize) === 0) {
			// let hurl = node.metadata.octreeDir + "/../hierarchy/" + node.name + ".hrc";
			// console.log('metadata', node.metadata);
			let hierarchyURL = node.metadata.baseURL + "/loadTree?ProjectId=" + node.metadata.projectID + "&PclId=" + node.metadata.pointCloudID + "&TileId=" + node.name;

			let xhr = XHRFactory.createXMLHttpRequest();
			xhr.open('GET', hierarchyURL, true);
			xhr.responseType = 'json';
			// xhr.overrideMimeType('text/plain; charset=x-user-defined');
			xhr.onreadystatechange = () => {
				if (xhr.readyState === 4) {
					if (xhr.status === 200 || xhr.status === 0) {
						let response = xhr.response;
						callback(node, response);
					} else {
						console.log('Failed to load file! HTTP status: ' + xhr.status + ', file: ' + hurl);
						Potree.numNodesLoading--;
					}
				}
			};
			try {
				xhr.send(null);
			} catch (e) {
				console.log('fehler beim laden der punktwolke: ' + e);
			}
		}
	}

	getNumPoints(){
		return this.numPoints;
	}

	dispose(){
		if (this.geometry && this.parent != null) {
			this.geometry.dispose();
			this.geometry = null;
			this.loaded = false;

			this.dispatchEvent( { type: 'dispose' } );
			
			for (let i = 0; i < this.oneTimeDisposeHandlers.length; i++) {
				let handler = this.oneTimeDisposeHandlers[i];
				handler();
			}
			this.oneTimeDisposeHandlers = [];
		}
	}
	
}

BeagleNode.IDCount = 0;
