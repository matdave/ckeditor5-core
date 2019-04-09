/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/* globals console, window, document */

import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';
import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ArticlePluginSet from '../_utils/articlepluginset';

/**
 * Plugin that converts custom attributes for elements that are wrapped in <figure> in the view.
 *
 * @extends module:core/plugin~Plugin
 */
class CustomFigureAttributes extends Plugin {
	init() {
		const editor = this.editor;

		// The 'customClass' attribute will store custom classes from data in the model so schema definitions to allow this attribute.
		editor.model.schema.extend( 'image', { allowAttributes: [ 'customClass' ] } );
		editor.model.schema.extend( 'table', { allowAttributes: [ 'customClass' ] } );

		// Define upcast converters for <img> and <table> elements with "low" priority so they are run after default converters.
		editor.conversion.for( 'upcast' ).add( upcastCustomClasses( 'img' ), { priority: 'low' } );
		editor.conversion.for( 'upcast' ).add( upcastCustomClasses( 'table' ), { priority: 'low' } );

		// Define downcast converters for 'image' and 'table' model elements with "low" priority so they are run after default converters.
		editor.conversion.for( 'downcast' ).add( downcastCustomClasses( 'image', 'img' ), { priority: 'low' } );
		editor.conversion.for( 'downcast' ).add( downcastCustomClasses( 'table', 'table' ), { priority: 'low' } );

		// Define custom attributes that should be preserved.
		setupCustomAttributeConversion( 'img', 'image', 'id', editor );
		setupCustomAttributeConversion( 'table', 'table', 'id', editor );
		setupCustomAttributeConversion( 'table', 'table', 'width', editor );
	}
}

/**
 * Creates upcast converter that will pass all classes from view element to model element.
 *
 * @param {String} elementName
 * @returns {Function}
 */
function upcastCustomClasses( elementName ) {
	return dispatcher => dispatcher.on( `element:${ elementName }`, ( evt, data, conversionApi ) => {
		const viewItem = data.viewItem;
		const modelRange = data.modelRange;

		const modelElement = modelRange && modelRange.start.nodeAfter;

		if ( !modelElement ) {
			return;
		}

		conversionApi.writer.setAttribute( 'customClass', [ ...viewItem.getClassNames() ], modelElement );
	} );
}

/**
 * Creates downcast converter that add classes defined in `customClass` attribute to given view element.
 *
 * This converter expects that view element is nested in figure element.
 *
 * @param {String} modelElementName
 * @param {String} viewElementName
 * @returns {Function}
 */
function downcastCustomClasses( modelElementName, viewElementName ) {
	return dispatcher => dispatcher.on( `insert:${ modelElementName }`, ( evt, data, conversionApi ) => {
		const modelElement = data.item;

		const viewFigure = conversionApi.mapper.toViewElement( modelElement );
		const viewElement = findViewChild( viewFigure, viewElementName, conversionApi );

		if ( !viewElement ) {
			return;
		}

		// The below code assumes that classes are set directly on <img> element.
		conversionApi.writer.addClass( modelElement.getAttribute( 'customClass' ), viewElement );

		// If the classes should be passed to the <figure> use (instead of above):
		// conversionApi.writer.addClass( modelElement.getAttribute( 'customClass' ), viewFigure );
	} );
}

/**
 * Helper method that search for given view element in all children of model element.
 *
 * @param {module:engine/view/item~Item} viewElement
 * @param {String} viewElementName
 * @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
 * @return {module:engine/view/item~Item}
 */
function findViewChild( viewElement, viewElementName, conversionApi ) {
	const viewChildren = [ ...conversionApi.writer.createRangeIn( viewElement ).getItems() ];

	return viewChildren.find( item => item.is( viewElementName ) );
}

/**
 * Setups conversion for custom attribute on view elements contained inside figure.
 *
 * This method:
 *
 * - adds proper schema rules
 * - adds an upcast converter
 * - adds a downcast converter
 *
 * @param {String} viewElementName
 * @param {String} modelElementName
 * @param {String} viewAttribute
 * @param {module:core/editor/editor~Editor} editor
 */
function setupCustomAttributeConversion( viewElementName, modelElementName, viewAttribute, editor ) {
	// Extend schema to store attribute in the model.
	const modelAttribute = `custom-${ viewAttribute }`;

	editor.model.schema.extend( modelElementName, { allowAttributes: [ modelAttribute ] } );

	editor.conversion.for( 'upcast' ).add( upcastAttribute( viewElementName, viewAttribute, modelAttribute ) );
	editor.conversion.for( 'downcast' ).add( downcastAttribute( modelElementName, viewElementName, viewAttribute, modelAttribute ) );
}

/**
 * Returns custom attribute upcast converter.
 *
 * @param {String} viewElementName
 * @param {String} viewAttribute
 * @param {String} modelAttribute
 * @returns {Function}
 */
function upcastAttribute( viewElementName, viewAttribute, modelAttribute ) {
	return dispatcher => dispatcher.on( `element:${ viewElementName }`, ( evt, data, conversionApi ) => {
		const viewItem = data.viewItem;
		const modelRange = data.modelRange;

		const modelElement = modelRange && modelRange.start.nodeAfter;

		if ( !modelElement ) {
			return;
		}

		conversionApi.writer.setAttribute( modelAttribute, viewItem.getAttribute( viewAttribute ), modelElement );
	} );
}

/**
 * Returns custom attribute downcast converter.
 *
 * @param {String} modelElementName
 * @param {String} viewElementName
 * @param {String} viewAttribute
 * @param {String} modelAttribute
 * @returns {Function}
 */
function downcastAttribute( modelElementName, viewElementName, viewAttribute, modelAttribute ) {
	return dispatcher => dispatcher.on( `insert:${ modelElementName }`, ( evt, data, conversionApi ) => {
		const modelElement = data.item;

		const viewFigure = conversionApi.mapper.toViewElement( modelElement );
		const viewElement = findViewChild( viewFigure, viewElementName, conversionApi );

		if ( !viewElement ) {
			return;
		}

		conversionApi.writer.setAttribute( viewAttribute, modelElement.getAttribute( modelAttribute ), viewElement );
	} );
}

ClassicEditor
	.create( document.querySelector( '#editor' ), {
		// Add plugin alongside other plugins
		plugins: [ ArticlePluginSet, CustomFigureAttributes ],
		toolbar: [
			'heading',
			'|',
			'bold',
			'italic',
			'link',
			'bulletedList',
			'numberedList',
			'blockQuote',
			'insertTable',
			'mediaEmbed',
			'undo',
			'redo'
		],
		image: {
			toolbar: [ 'imageStyle:full', 'imageStyle:side', '|', 'imageTextAlternative' ]
		},
		table: {
			contentToolbar: [
				'tableColumn',
				'tableRow',
				'mergeTableCells'
			]
		}
	} )
	.then( editor => {
		window.editor = editor;
	} )
	.catch( err => {
		console.error( err.stack );
	} );