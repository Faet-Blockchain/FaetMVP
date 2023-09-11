import { BaseModule, ModuleInitArgs, ModuleMetadata, NFTMethod } from 'lisk-sdk';
import { TestNftEndpoint } from './endpoint';
import { TestNftMethod } from './method';
import { MintNftCommand } from './commands/mint_nft';
import { DestroyNftCommand } from './commands/destroy_nft';

export class TestNftModule extends BaseModule {
	public endpoint = new TestNftEndpoint(this.stores, this.offchainStores);
	public method = new TestNftMethod(this.stores, this.events);
	public mintNftCommand = new MintNftCommand(this.stores, this.events);
	public destroyNftCommand = new DestroyNftCommand(this.stores, this.events);
	public commands = [this.mintNftCommand, this.destroyNftCommand];

	private _nftMethod!: NFTMethod;

	public addDependencies(nftMethod: NFTMethod) {
		this._nftMethod = nftMethod;
	}

	public metadata(): ModuleMetadata {
		return {
			...this.baseMetadata(),
			endpoints: [],
			commands: this.commands.map(command => ({
				name: command.name,
				params: command.schema,
			})),
			events: [],
			assets: [],
		};
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async init(_args: ModuleInitArgs) {
		this.mintNftCommand.init({
			nftMethod: this._nftMethod,
		});
		this.destroyNftCommand.init({
			nftMethod: this._nftMethod,
		});
	}
}
