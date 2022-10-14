const { makeCosmoshubPath, makeSignDoc, makeStdTx } = require("@cosmjs/amino");
const { pathToString } = require("@cosmjs/crypto");
// const { toBase64 } = require("@cosmjs/encoding");
// eslint-disable-next-line @typescript-eslint/naming-convention
const { LedgerSigner } = require("@cosmjs/ledger-amino");
// eslint-disable-next-line @typescript-eslint/naming-convention
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
// const fetch = require("node-fetch");
const fetch = require("cross-fetch");
const { TxRaw, Tx } = require("cosmjs-types/cosmos/tx/v1beta1/tx");
const { fromBase64, toBase64 } = require("@cosmjs/encoding");
import {
  AccAddress,
  Coin,
  CreateTxOptions,
  Denom,
  Fee,
  Key,
  LCDClient,
  MnemonicKey,
  Msg,
  MsgExecuteContract,
  MsgSend,
  RawKey,
  // Tx,
  Wallet,
} from "@terra-money/terra.js";
import { TerraLedgerKey } from "./terraledger";

const interactiveTimeout = 120_000;
const accountNumbers = [0, 1, 2, 10];
const paths = accountNumbers.map(makeCosmoshubPath);

const defaultChainId = "cosmoshub-4";
const defaultFee = {
  amount: [{ amount: "1000", denom: "uatom" }],
  gas: "250000",
};
const defaultMemo = "Some memo";
const defaultSequence = "0";

async function getAccount(address: string) {
  return fetch(
    "https://cosmos-lcd.quickapi.com/cosmos/auth/v1beta1/accounts/" + address
  );
}

async function signMsgSend(
  signer: any,
  accountNumber: string,
  fromAddress: string,
  toAddress: string
) {
  const resp = await getAccount(fromAddress);
  console.log({ data: resp });

  const json = await resp.json();
  console.log({ data: json.account });

  const account_number = json.account.account_number ?? "0";
  const sequence = json.account.sequence ?? "0";

  const msg = {
    type: "cosmos-sdk/MsgSend",
    value: {
      amount: [
        {
          amount: "123",
          denom: "uatom",
        },
      ],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      from_address: fromAddress,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      to_address: toAddress,
    },
  };
  const signDoc = makeSignDoc(
    [msg],
    defaultFee,
    defaultChainId,
    defaultMemo,
    account_number, // accountNumber,
    sequence //defaultSequence
  );
  const { signature } = await signer.signAmino(fromAddress, signDoc);
  return { signature, signDoc };
}

// TODO: fix me
async function broadcastTx(txObj: any) {
  const resp = await fetch(
    "https://cosmos-lcd.quickapi.com/cosmos/auth/v1beta1/accounts/txs",
    {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
      },
      //   referrer: "https://docs.figment.io/",
      referrerPolicy: "strict-origin-when-cross-origin",
      //   body: '{\n  "tx": {\n    "msg": [\n      "string"\n    ],\n    "fee": {\n      "gas": "string",\n      "amount": [\n        {\n          "denom": "stake",\n          "amount": "50"\n        }\n      ]\n    },\n    "memo": "string",\n    "signature": {\n      "signature": "MEUCIQD02fsDPra8MtbRsyB1w7bqTM55Wu138zQbFcWx4+CFyAIge5WNPfKIuvzBZ69MyqHsqD8S1IwiEp+iUb6VSdtlpgY=",\n      "pub_key": {\n        "type": "tendermint/PubKeySecp256k1",\n        "value": "Avz04VhtKJh8ACCVzlI8aTosGy0ikFXKIVHQ3jKMrosH"\n      },\n      "account_number": "0",\n      "sequence": "0"\n    }\n  },\n  "mode": "block"\n}',
      method: "POST",
      body: JSON.stringify({ mode: "block", tx: txObj }),
      mode: "cors",
      credentials: "omit",
    }
  );
  const data = resp.json();
  console.log({ data });
  return data;
}

async function runLedgerV1() {
  console.log("ledger transport init");
  const ledgerTransport = await TransportNodeHid.create(
    interactiveTimeout,
    interactiveTimeout
  );
  console.log("ledger transport initialized");
  const signer = new LedgerSigner(ledgerTransport, {
    testModeAllowed: true,
    hdPaths: paths,
    prefix: "cosmos",
  });

  const accounts = await signer.getAccounts();
  const printableAccounts = accounts.map((account: any) => ({
    ...account,
    pubkey: toBase64(account.pubkey),
  }));
  console.info("Accounts from Ledger device:");
  console.table(
    printableAccounts.map((account: any, i: number) => ({
      ...account,
      hdPath: pathToString(paths[i]),
    }))
  );

  //   console.info("Showing address of first account on device");
  //   await signer.showAddress();
  //   console.info("Showing address of 3rd account on device");
  //   await signer.showAddress(paths[2]); // Path of 3rd account

  const accountNumber0 = 0;
  const address0 = accounts[accountNumber0].address;
  console.info(
    `Signing on Ledger device with account index ${accountNumber0} (${address0}). Please review and approve on the device now.`
  );
  const { signature, signDoc } = await signMsgSend(
    signer,
    String(accountNumber0),
    address0,
    address0
  );
  console.info("Signature:", signature);

  const stdTx = makeStdTx(signDoc, [signature]);

  //   const txBodyBytes =

  const txRaw = Tx.fromPartial({
    body: {
      ...signDoc,
    },
    // authInfoBytes: authInfoBytes,
    signatures: [fromBase64(signature.signature)],
  });

  const txRawBytes = Uint8Array.from(Tx.encode(txRaw).finish());

  console.log({ txRawBytes });
  // TODO: FIXME
  const broadcastResponse = await broadcastTx(stdTx);
  console.log({ broadcastResponse });
}

async function runLedgerV2() {
  console.log("ledger transport init");
  const ledgerTransport = await TransportNodeHid.create(
    interactiveTimeout,
    interactiveTimeout
  );
  console.log("ledger transport initialized");
  const signer = new LedgerSigner(ledgerTransport, {
    testModeAllowed: true,
    hdPaths: paths,
    prefix: "cosmos",
  });

  const accounts = await signer.getAccounts();
  const printableAccounts = accounts.map((account: any) => ({
    ...account,
    pubkey: toBase64(account.pubkey),
  }));
  console.info("Accounts from Ledger device:");
  console.table(
    printableAccounts.map((account: any, i: number) => ({
      ...account,
      hdPath: pathToString(paths[i]),
    }))
  );

  //   console.info("Showing address of first account on device");
  //   await signer.showAddress();
  //   console.info("Showing address of 3rd account on device");
  //   await signer.showAddress(paths[2]); // Path of 3rd account

  const accountNumber0 = 0;
  const address0 = accounts[accountNumber0].address;
  console.info(
    `Signing on Ledger device with account index ${accountNumber0} (${address0}). Please review and approve on the device now.`
  );

  await ledgerTransport.close();

  const resp = await getAccount(address0);
  console.log({ data: resp });

  const json = await resp.json();
  console.log({ data: json.account });

  const account_number = json.account.account_number ?? "0";
  const sequence = json.account.sequence ?? "0";

  console.log({ account_number, sequence });

  const unsignedTx: CreateTxOptions = {
    memo: "test",
    fee: new Fee(100000, [new Coin("uatom", "10000")]),
    msgs: [],
  };

  unsignedTx.msgs = [
    new MsgSend(address0, address0, [new Coin("uatom", "123")]),
  ];

  const lcdClient = new LCDClient({
    URL: "https://cosmos-lcd.quickapi.com",
    chainID: "cosmoshub-4",
  });
  const wallet = new Wallet(
    lcdClient,
    new TerraLedgerKey(
      "cosmos",
      pathToString(paths[0]),
      printableAccounts[0].pubkey
    )
  );

  const signedTx = await wallet.createAndSignTx(unsignedTx);

  console.log({ signedTx });

  const result = await lcdClient.tx.broadcastSync(signedTx);

  console.log({ result });
  // create and sign
}

async function run() {
  //   const resp = await getAccount(
  //     "cosmos1nm0rrq86ucezaf8uj35pq9fpwr5r82cl8sc7p5"
  //   );
  //   const json = await resp.json();
  //   console.log({ data: json.account });

  //   const account_number = json.account.account_number ?? "0";
  //   const sequence = json.account.sequence ?? "0";

  //   console.log({ account_number, sequence });
  //   return;
  //   await runLedgerV1();

  await runLedgerV2();

  // It seems the Ledger device needs a bit of time to recover
  await new Promise((resolve) => setTimeout(resolve, 1000));

  //   const accountNumber10 = 10;
  //   const address10 =
  //     accounts[accountNumbers.findIndex((n) => n === accountNumber10)].address;
  //   console.info(
  //     `Signing on Ledger device with account index ${accountNumber10} (${address10}). Please review and approve on the device now.`
  //   );
  //   const signature1 = await signMsgSend(
  //     signer,
  //     accountNumber10,
  //     address10,
  //     address10
  //   );
  //   console.info("Signature:", signature1);
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
