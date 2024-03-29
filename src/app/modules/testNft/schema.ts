import {
	LENGTH_COLLECTION_ID,
	LENGTH_NFT_ID,
	MAX_LENGTH_MODULE_NAME,
	MIN_LENGTH_MODULE_NAME,
} from './constants';

export const mintNftParamsSchema = {
	$id: '/lisk/nftTransferParams',
	type: 'object',
	required: ['address', 'collectionID', 'attributesArray'],
	properties: {
		address: {
			dataType: 'bytes',
			format: 'lisk32',
			fieldNumber: 1,
		},
		collectionID: {
			dataType: 'bytes',
			minLength: LENGTH_COLLECTION_ID,
			maxLength: LENGTH_COLLECTION_ID,
			fieldNumber: 2,
		},
		attributesArray: {
			type: 'array',
			fieldNumber: 4,
			items: {
				type: 'object',
				required: ['module', 'attributes'],
				properties: {
					module: {
						dataType: 'string',
						minLength: MIN_LENGTH_MODULE_NAME,
						maxLength: MAX_LENGTH_MODULE_NAME,
						pattern: '^[a-zA-Z0-9]*$',
						fieldNumber: 1,
					},
					attributes: {
						dataType: 'string',
						fieldNumber: 2,
					},
				},
			},
		},
	},
};

export const destroyNftParamsSchema = {
	$id: '/lisk/nftDestroyParams',
	type: 'object',
	required: ['address', 'nftID'],
	properties: {
		address: {
			dataType: 'bytes',
			format: 'lisk32',
			fieldNumber: 1,
		},
		nftID: {
			dataType: 'bytes',
			minLength: LENGTH_NFT_ID,
			maxLength: LENGTH_NFT_ID,
			fieldNumber: 2,
		},
	},
};
