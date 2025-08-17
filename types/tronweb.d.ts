declare module 'tronweb' {
  interface TronAddress {
    hex: string;
    base58: string;
  }

  class TronWeb {
    constructor(options: any);
    
    static providers: {
      HttpProvider: any;
    };

    defaultAddress: {
      base58: string;
      hex: string;
    };

    ready: boolean;
    
    fullNode: {
      host: string;
      chainId?: string;
    };

    contract: (abi: any[], address: string) => Promise<any>;
    trx: {
      getContract: (address: string) => Promise<any>;
      getTransactionInfo: (txId: string) => Promise<any>;
      getCurrentBlock: () => Promise<any>;
    };
    isAddress: (address: string) => boolean;
    address: {
      fromHex: (hex: string) => string;
      toHex: (address: string) => string;
    };
    on: (event: string, callback: (address: string | TronAddress) => void) => void;
    off: (event: string) => void;
  }

  export default TronWeb;
}

interface Window {
  tronWeb?: TronWeb;
  tronLink?: {
    ready: boolean;
    request: (args: { method: string }) => Promise<string[]>;
    isTronLink?: boolean;
  };
  trustwallet?: {
    tron?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isTrustWallet?: boolean;
    };
  };
  ethereum?: {
    isTrustWallet?: boolean;
    isMetaMask?: boolean;
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on: (event: string, callback: (params: any) => void) => void;
    removeListener: (event: string, callback: (params: any) => void) => void;
  };
}