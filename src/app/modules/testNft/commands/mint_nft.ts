import { BaseCommand, CommandExecuteContext, NFTMethod } from 'lisk-sdk';
import { NFTAttributes } from '../types';
import { mintNftParamsSchema } from '../schema';

interface Params {
	address: Buffer;
	collectionID: Buffer;
	attributesArray: NFTAttributes[];
}

export class MintNftCommand extends BaseCommand {
	private _nftMethod!: NFTMethod;
	public schema = mintNftParamsSchema;

	public init(args: { nftMethod: NFTMethod }): void {
		this._nftMethod = args.nftMethod;
	}

	public async execute(context: CommandExecuteContext<Params>): Promise<void> {
		const { params } = context;

		await this._nftMethod.create(
			context.getMethodContext(),
			params.address,
			params.collectionID,
			params.attributesArray,
		);
	}
}
