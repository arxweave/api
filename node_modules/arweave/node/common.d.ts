import Ar from "./ar";
import Api, { ApiConfig } from "./lib/api";
import CryptoInterface from "./lib/crypto/crypto-interface";
import Network from "./network";
import Transactions from "./transactions";
import Wallets from "./wallets";
import Transaction, { Tag } from "./lib/transaction";
import { JWKInterface } from "./lib/wallet";
import * as ArweaveUtils from "./lib/utils";
import Silo from "./silo";
export interface Config {
    api: ApiConfig;
    crypto: CryptoInterface;
}
export interface CreateTransactionInterface {
    last_tx: string;
    owner: string;
    tags: Tag[];
    target: string;
    quantity: string;
    data: string | Uint8Array;
    reward: string;
}
export default class Arweave {
    api: Api;
    wallets: Wallets;
    transactions: Transactions;
    network: Network;
    ar: Ar;
    silo: Silo;
    crypto: CryptoInterface;
    utils: typeof ArweaveUtils;
    static init: (apiConfig: ApiConfig) => Arweave;
    constructor(config: Config);
    getConfig(): Config;
    createTransaction(attributes: Partial<CreateTransactionInterface>, jwk: JWKInterface): Promise<Transaction>;
    createSiloTransaction(attributes: Partial<CreateTransactionInterface>, jwk: JWKInterface, siloUri: string): Promise<Transaction>;
    arql(query: object): Promise<string[]>;
}
