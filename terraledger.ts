import { Key, PublicKey, SignatureV2, SignDoc } from "@terra-money/terra.js";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { LedgerSigner } from "@cosmjs/ledger-amino";
import { makeCosmoshubPath } from "@cosmjs/amino";
import Cosmos from "@ledgerhq/hw-app-cosmos";
import { bech32 } from "bech32";
import { SHA256 } from "jscrypto/SHA256";
import { RIPEMD160 } from "jscrypto/RIPEMD160";
// import { Base64 } from "jscrypto/Base64";
import { Word32Array } from "jscrypto";
/**
 * Calculates the transaction hash from Amino-encoded string.
 * @param data raw bytes
 */
export function sha256(data: Uint8Array): Uint8Array {
  return SHA256.hash(new Word32Array(data)).toUint8Array();
}

export function ripemd160(data: Uint8Array): Uint8Array {
  return RIPEMD160.hash(new Word32Array(data)).toUint8Array();
}

export class TerraLedgerKey extends Key {
  derivationPath: string;
  _publicKey: string;
  _prefix: string;
  constructor(prefix: string, derivationPath: string, publicKey: string) {
    super(
      PublicKey.fromAmino({
        type: "tendermint/PubKeySecp256k1",
        value: publicKey,
      })
    );
    this.derivationPath = derivationPath;
    this._publicKey = publicKey;
    this._prefix = prefix;
    console.log({derivationPath, publicKey, prefix})
  }

  public sign(): Promise<Buffer> {
    throw new Error(
      "LedgerKey does not use sign() -- use createSignatureAmino() directly."
    );
  }

  public get accAddress(): string {
    if (!this.publicKey) {
      throw new Error("Could not compute accAddress: missing rawAddress");
    }

    const auxRes = bech32.encode(
      this._prefix,
      bech32.toWords(this.rawAddress())
    );
    console.debug({ auxRes });
    return auxRes;
  }

  public rawAddress(): Uint8Array {
    const pubkeyData = Buffer.from(this._publicKey, "base64");
    const rawAddr= ripemd160(sha256(pubkeyData));

    return rawAddr
  }

  private async signTerraTransaction(
    derivPath: string,
    aminoJsonString: string
  ) {
    const ledgerTransport = await TransportNodeHid.create(10000, 10000);
    console.log("ledger transport initialized");
    // const signer = new LedgerSigner(ledgerTransport, {
    //   testModeAllowed: true,
    //   hdPaths: [makeCosmoshubPath(0)],
    //   prefix: "cosmos",
    // });
    const app = new Cosmos(ledgerTransport);
    const { signature } = await app.sign(derivPath, aminoJsonString);
    return signature;
  }

  public async createSignature(tx: SignDoc): Promise<SignatureV2> {
    if (!this.publicKey) {
      throw new Error("Failed getting public key from ledger");
    }

    const signatureBuffer = await this.signTerraTransaction(
      this.derivationPath,
      tx.toAminoJSON()
    );

    if (!signatureBuffer) {
      throw new Error("failed signing from ledger");
    }

    return new SignatureV2(
      this.publicKey,
      new SignatureV2.Descriptor(
        new SignatureV2.Descriptor.Single(
          SignatureV2.SignMode.SIGN_MODE_LEGACY_AMINO_JSON,
          signatureBuffer.toString("base64")
        )
      ),
      tx.sequence
    );
  }
}
