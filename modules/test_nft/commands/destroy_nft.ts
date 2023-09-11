import { BaseCommand, CommandExecuteContext, NFTMethod } from 'lisk-sdk';
import { destroyNftParamsSchema } from '../schema';

interface Params {
	address: Buffer;
	nftID: Buffer;
}

export class DestroyNftCommand extends BaseCommand {
	private _nftMethod!: NFTMethod;
	public schema = destroyNftParamsSchema;

	public init(args: { nftMethod: NFTMethod }): void {
		this._nftMethod = args.nftMethod;
	}

	public async execute(context: CommandExecuteContext<Params>): Promise<void> {
		const { params } = context;

		await this._nftMethod.destroy(context.getMethodContext(), params.address, params.nftID);
	}
}
