import { BufferGeometry, MeshBasicMaterial, BufferAttribute, Mesh } from 'three';
import { MeshBVH, SAH } from 'three-mesh-bvh';
import { StaticGeometryGenerator } from './utils/StaticGeometryGenerator.js';
import { setCommonAttributes, getGroupMaterialIndicesAttribute } from '../utils/GeometryPreparationUtils.js';

// collect the textures from the materials
function getTextures( materials ) {

	const textureSet = new Set();
	for ( let i = 0, l = materials.length; i < l; i ++ ) {

		const material = materials[ i ];
		for ( const key in material ) {

			const value = material[ key ];
			if ( value && value.isTexture ) {

				textureSet.add( value );

			}

		}

	}

	return Array.from( textureSet );

}

// collect the lights in the scene
function getLights( objects ) {

	const lights = [];
	for ( let i = 0, l = objects.length; i < l; i ++ ) {

		objects[ i ].traverse( c => {

			if (
				c.isRectAreaLight ||
				c.isSpotLight ||
				c.isPointLight ||
				c.isDirectionalLight
			) {

				lights.push( c );

			}

		} );

	}

	return lights;

}

const dummyMaterial = new MeshBasicMaterial();
export function getDummyMesh() {

	const emptyGeometry = new BufferGeometry();
	emptyGeometry.setAttribute( 'position', new BufferAttribute( new Float32Array( 9 ), 3 ) );
	return new Mesh( emptyGeometry, dummyMaterial );

}

export class DynamicPathTracingSceneGenerator {

	get initialized() {

		return Boolean( this.bvh );

	}

	constructor( objects ) {

		// ensure the objects is an array
		if ( ! Array.isArray( objects ) ) {

			objects = [ objects ];

		}

		// use a dummy object for a fallback
		const finalObjects = [ ...objects ];
		if ( finalObjects.length === 0 ) {

			finalObjects.push( getDummyMesh() );

		}

		// options
		this.bvhOptions = {};
		this.attributes = [ 'position', 'normal', 'tangent', 'color', 'uv', 'uv2' ];

		// state
		this.objects = finalObjects;
		this.bvh = null;
		this.geometry = new BufferGeometry();
		this.staticGeometryGenerator = new StaticGeometryGenerator( this.objects );

	}

	reset() {

		this.bvh = null;
		this.geometry.dispose();
		this.geometry = new BufferGeometry();
		this.staticGeometryGenerator = new StaticGeometryGenerator( this.objects );

	}

	dispose() {}

	generate() {

		const { objects, staticGeometryGenerator, geometry, attributes } = this;
		staticGeometryGenerator.attributes = attributes;

		// collect lights
		for ( let i = 0, l = objects.length; i < l; i ++ ) {

			objects[ i ].traverse( c => {

				if ( c.isMesh ) {

					// TODO: move to this to StaticGeometryGenerator
					setCommonAttributes( c.geometry, attributes );

				}

			} );

		}

		// generate the
		const result = staticGeometryGenerator.generate( geometry );
		const materials = result.materials;
		const textures = getTextures( materials );
		const lights = getLights( objects );

		// TODO: this needs to modify the material index if possible
		const materialIndexAttribute = getGroupMaterialIndicesAttribute( geometry, materials, materials );
		geometry.setAttribute( 'materialIndex', materialIndexAttribute );
		geometry.clearGroups();

		// update the skeleton animations in case WebGLRenderer is not running
		// to update it.
		objects.forEach( o => {

			o.traverse( c => {

				if ( c.isSkinnedMesh && c.skeleton ) {

					c.skeleton.update();

				}

			} );

		} );

		this.bvh = new MeshBVH( geometry, { strategy: SAH, maxLeafTris: 1, ...this.bvhOptions } );

		return {
			bvh: this.bvh,
			lights,
			geometry,
			materials,
			textures,
			objects,
		};

	}


}
