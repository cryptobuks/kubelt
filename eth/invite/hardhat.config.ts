// eth/invite/hardhat.config.ts

import * as cheerio from "cheerio";
import * as path from "path";
import chalk from 'chalk';
import fs from "fs";
import https from "node:https";
import url from "node:url";
import { NFTStorage, File } from "nft.storage";
import { createAlchemyWeb3 } from "@alch/alchemy-web3";
import { HardhatUserConfig } from "hardhat/types";
import { subtask, task, types } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-solhint";

import {
  // Plugin configuration
  ETHERSCAN,
  // Network-specific configuration
  NET_LOCALHOST,
  NET_GOERLI,
  NET_MAINNET,
} from "./secret";

// definitions
// -----------------------------------------------------------------------------

// The name of the invitation contract.
const CONTRACT_NAME = "ThreeId_Invitations";

// The location for generated assets.
const OUTPUT_DIR = path.resolve("outputs");

// In case we do multiple issues of invitations, we'll assign a unique
// name to each issue.
const INVITE_TIER = "generation#0";

// Chain IDs are added to hardhat configuration to perform an additional
// bit of validation that you're talking to the network you think you're
// talking to.
const MAINNET_CHAIN_ID = 1;
const GOERLI_CHAIN_ID = 5;

// SUBTASKS
// -----------------------------------------------------------------------------
// cf. https://hardhat.org/hardhat-runner/docs/advanced/create-task
//
// * The only requirement for writing a task is that the Promise returned
//   by its action must not resolve before every async process it started
//   is finished.
//
// The task() function signature:
// - task name
// - task description
// - callback(...)
//   - taskArguments: an object with parsed CLI arguments
//   - hre: the Hardhat Runtime Environment
//   - runSuper: when overriding an existing task, allows to invoke the
//     super implementation

subtask("network:config", "Return network-specific configuration map")
  .setAction(async (taskArgs, hre) => {
    switch (hre.network.name) {
      case "localhost":
        return NET_LOCALHOST;
        break;
      case "goerli":
        return NET_GOERLI;
        break;
      case "mainnet":
        return NET_MAINNET;
        break;
      default:
        throw "no configuration defined";
    }
  });

subtask("config:contract", "Return contract address for selected network")
  .addOptionalParam("contract", "A contract address")
  .setAction(async (taskArgs, hre) => {
    const contract = taskArgs.contract;
    if (contract && (contract.startsWith("0x") || contract.endsWith(".eth"))) {
      return contract;
    } else {
      const config = await hre.run("network:config");
      return config.contract;
    }
  });

subtask("config:account", "Return account address for selected network")
  .addParam("account", "An account name or address")
  .setAction(async (taskArgs, hre) => {
    const account = taskArgs.account;
    // If user supplied an account address (0x...) or ENS name (X.eth),
    // use it. Otherwise, try mapping the supplied string to a
    // configured account. If that fails, we have no account to work
    // with, spill spaghetti.
    if (account.startsWith("0x") || account.endsWith(".eth")) {
      return account;
    } else {
      const config = await hre.run("network:config");
      const result = config.user[account];
      if (result) {
        return result;
      } else {
        throw `no such ${hre.network.name} account: ${account}`;
      }
    }
  });

subtask("config:alchemyURL", "Return alchemy invite application URL")
  .setAction(async (taskArgs, hre) => {
    const config = await hre.run("network:config");
    return config.alchemy.appURL;
  });

subtask("config:storageKey", "Return nft.storage API key")
  .setAction(async (taskArgs, hre) => {
    const config = await hre.run("network:config");
    return config.storage.apiKey;
  });

subtask("call:maxInvites", `Return result of ${CONTRACT_NAME}.maxInvites()`)
  .addParam("contract", "The address of the invite contract")
  .setAction(async (taskArgs, hre) => {
    const contract = taskArgs.contract;
    const invite = await hre.ethers.getContractAt(CONTRACT_NAME, contract);
    return invite.maxInvitations();
  });

subtask("call:ownerOf", `Return result of ${CONTRACT_NAME}.ownerOf(tokenId)`)
  .addParam("contract", "The address of the invite contract")
  .addParam("inviteId", "The invitation number")
  .setAction(async (taskArgs, hre) => {
    const contract = taskArgs.contract;
    const inviteId = taskArgs.inviteId;
    const invite = await hre.ethers.getContractAt(CONTRACT_NAME, contract);
    return invite.ownerOf(inviteId);
  });

subtask("call:tokenURI", `Return result of ${CONTRACT_NAME}.tokenURI(tokenId)`)
  .addParam("contract", "The address of the invite contract")
  .addParam("inviteId", "The invitation number")
  .setAction(async (taskArgs, hre) => {
    const contract = taskArgs.contract;
    const inviteId = taskArgs.inviteId;
    const invite = await hre.ethers.getContractAt(CONTRACT_NAME, contract);
    return invite.tokenURI(inviteId);
  });

subtask("call:nextInvite", "Return the ID of next invitation")
  .addParam("contract", "The address of the invite contract")
  .setAction(async (taskArgs, hre) => {
    const contract = taskArgs.contract;
    const invite = await hre.ethers.getContractAt(CONTRACT_NAME, contract);
    return invite.nextInvite();
  });

subtask("call:awardInvite", "Mint invitation NFT")
  .addParam("account", "The address of the invitee")
  .addParam("contract", "The invite smart contract address")
  .addParam("tokenURI", "The URI to set for the invitation")
  .setAction(async (taskArgs, hre) => {
    const account = taskArgs.account;
    const contract = taskArgs.contract;
    const tokenURI = taskArgs.tokenURI;

    const invite = await hre.ethers.getContractAt(CONTRACT_NAME, contract);
    return invite.awardInvite(account, tokenURI);
  });

subtask("storage:url", "Returns IPFS gateway URL instance for CID and path")
  .addParam("cid", "The CID for content stored in IPFS")
  .addParam("path", "URL path component")
  .setAction(async (taskArgs, hre) => {
    const cid = taskArgs.cid;
    const path = taskArgs.path;
    let url = new URL(`https://${cid}.ipfs.nftstorage.link`);
    url.pathname = path;
    return url;
  });

subtask("fetch:metadata", "Display the metadata for the invite")
  .addParam("contract", "The invite contract address")
  .addParam("invite", "The invitation # to check")
  .setAction(async (taskArgs, hre) => {
    const contract = taskArgs.contract;
    const inviteId = taskArgs.invite;
    const uri = await hre.run("call:tokenURI", { contract, inviteId });

    // The uri looks something like ipfs://<cid>/metadata.json.
    const cid = (new URL(uri)).host;
    const url = await hre.run("storage:url", { cid, path: "/metadata.json" });

    return new Promise((resolve, reject) => {
      https.get(url.href, (res) => {
        const { statusCode } = res;

        res.setEncoding('utf8');

        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          const parsedData = JSON.parse(rawData);
          resolve(parsedData);
        });
      }).on('error', (e) => {
        let message;
        if (e instanceof Error) {
          message = e.message;
        } else {
          message = String(e);
        }
        console.error(message);
        reject(message);
      });
    });
  });

subtask("invite:generate-nft-asset", "Generate custom NFT image asset")
  .addParam("inviteId", "The invite identifier (0-padded, 4 digits)")
  .addParam("issueDate", "Date of issue for the token")
  .addParam("assetFile", "Path to SVG asset template")
  .addParam("outputFile", "Path to the output SVG asset file")
  .setAction(async (taskArgs, hre) => {
    const inviteId = taskArgs.inviteId;
    const issueDate = taskArgs.issueDate;
    const assetFile = taskArgs.assetFile;
    const outputFile = taskArgs.outputFile;

    return fs.promises.readFile(assetFile, 'utf8')
      .then(data => {
        // Parse the SVG XML data and return a query context.
        return cheerio.load(data, {
          xml: {},
        });
      })
      .then(($) => {
        /*
        <svg>
          ...
          <text id="ISSUED">04/20/2022</text>
          <text id="NUMBER">#6969</text>
        </svg>
        */
        // Set the issue date.
        $('#ISSUED').text(issueDate);
        // Set the invite identifier.
        $('#NUMBER').text(`#${inviteId}`);

        const svgText = $.root().html();
        if (null === svgText) {
          throw "empty SVG document generated";
        }
        return svgText.trim();
      })
      .then(svgText => {
        return fs.promises.writeFile(outputFile, svgText);
      })
  });

subtask("invite:publish-nft-storage", "Publish invite asset to nft.storage")
  .addParam("inviteId", "The invite identifier (0-padded, 4 digits)")
  .addParam("inviteTier", "The name of the invitation issue")
  .addParam("issueDate", "The token issue data (UTC)")
  .addParam("outputFile", "Path to generated image asset", "", types.inputFile)
  .addParam("storageKey", "The API key for nft.storage")
  .setAction(async (taskArgs, hre) => {
    const inviteId = taskArgs.inviteId;
    const inviteTier = taskArgs.inviteTier;
    const issueDate = taskArgs.issueDate;
    const outputFile = taskArgs.outputFile;
    const storageKey = taskArgs.storageKey;
    const baseName = path.basename(outputFile);

    const client = new NFTStorage({
      token: storageKey,
    });

    // Utility to title-case a string.
    const titleCase = (s: String) => {
      return s.charAt(0).toUpperCase() + s.slice(1);
    };

    const metadata = {
      name: `3iD invite #${inviteId}`,
      description: `${titleCase(inviteTier)} invitation to threeid.xyz`,
      image: new File(
        [await fs.promises.readFile(outputFile)],
        baseName,
        { type: 'image/svg+xml' },
      ),
      properties: {
        inviteId,
        inviteTier,
        issueDate,
      }
    }

    const result = await client.store(metadata);

    return {
      // IPFS URL of the metadata
      url: result.url,
      // The metadata.json contents
      metadata: result.data,
      // metadata.json contents with IPFS gateway URLs
      embed: result.embed(),
    };
  });

// TASKS
// -----------------------------------------------------------------------------

task("accounts:list", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("account:balance", "Prints an account balance")
  .addParam("account", "The account address")
  .setAction(async (taskArgs, hre) => {
    const account = await hre.run("config:account", { account: taskArgs.account });
    const balance = await hre.ethers.provider.getBalance(account);

    console.log(hre.ethers.utils.formatEther(balance), chalk.cyan("ETH"));
  });

task("account:nfts", "Gets the NFTs for an account (via Alchemy)")
  .addParam("account", "The account address")
  .setAction(async (taskArgs, hre) => {
    // If given an account (0x...) it is returned, and if given a string attempt to
    // look it up in network-specific configuration and return an account address.
    const account = await hre.run("config:account", { account: taskArgs.account });
    const alchemyURL = await hre.run("config:alchemyURL");

    // Construct the Alchemy client.
    const web3 = createAlchemyWeb3(alchemyURL);

    // The wallet address we want to query for NFTs:
    const nfts = await web3.alchemy.getNfts({
      owner: account,
      // Array of contract addresses to filter the responses with. Max. 20.
      //contractAddresses: [],
    });

    console.log(`> found ${nfts.totalCount} NFTs for account:`, account);

    // Print contract address and tokenId for each NFT:
    for (const nft of nfts.ownedNfts) {
      const response = await web3.alchemy.getNftMetadata({
        contractAddress: nft.contract.address,
        tokenId: nft.id.tokenId,
      });
      // Uncomment this line to see the full api response:
      // console.log(response);
      console.log(chalk.red("NFT"));
      console.log(chalk.green("-> contract:"), nft.contract.address);
      console.log(chalk.green("-> token ID:"), nft.id.tokenId);
      console.log(chalk.green("->     name:"), response.title);
      console.log(chalk.green("->     type:"), response.id?.tokenMetadata?.tokenType);
      console.log(chalk.green("->      uri:"), response.tokenUri?.gateway);
      console.log(chalk.green("->    image:"), response.metadata?.image);
      console.log(chalk.green("->  updated:"), response.timeLastUpdated);
    }
  });

task("invite:maximum", "Return maximum number of invites")
  .addOptionalParam("contract", "The invite contract address")
  .setAction(async (taskArgs, hre) => {
    const contract = await hre.run("config:contract", { contract: taskArgs.contract });
    const maxInvites = await hre.run("call:maxInvites", { contract });

    console.log(`> maximum ${maxInvites} invites`);
  });

task("invite:next", "Return ID of next invite that will be awarded")
  .addOptionalParam("contract", "The invite contract address")
  .setAction(async (taskArgs, hre) => {
    const contract = await hre.run("config:contract", { contract: taskArgs.contract });
    const nextInvite = await hre.run("call:nextInvite", { contract });

    console.log(`> next invite is #${nextInvite.toString().padStart(4, "0")}`);
  });

task("invite:owner", "Return owner of an invite")
  .addOptionalParam("contract", "The invite contract address")
  .addParam("invite", "The invitation # to check")
  .setAction(async (taskArgs, hre) => {
    const contract = await hre.run("config:contract", { contract: taskArgs.contract });
    const inviteId = taskArgs.invite;

    const owner = await hre.run("call:ownerOf", { contract, inviteId });

    console.log(chalk.red("OWNER"));
    console.log(chalk.green("-> contract:"), contract);
    console.log(chalk.green("->   invite:"), `#${inviteId.toString().padStart(4, "0")}`);
    console.log(chalk.green("->    owner:"), owner);
  });

task("invite:metadata", "Display the metadata for an invitation")
  .addOptionalParam("contract", "The invite contract address")
  .addParam("invite", "The invitation # to check")
  .setAction(async (taskArgs, hre) => {
    const contract = await hre.run("config:contract", { contract: taskArgs.contract });
    const invite = taskArgs.invite;

    const metadata = await hre.run("fetch:metadata", { contract, invite });
    console.log(metadata);
  });

task("invite:image", "Print the image URL for an invitation")
  .addOptionalParam("contract", "The invite contract address")
  .addParam("invite", "The invitation # to check")
  .setAction(async (taskArgs, hre) => {
    const contract = await hre.run("config:contract", { contract: taskArgs.contract });
    const invite = taskArgs.invite;

    const metadata = await hre.run("fetch:metadata", { contract, invite });
    const ipfsURL = new URL(metadata.image);
    const cid = ipfsURL.host;
    const path = `/invite-${metadata.properties.inviteId}.svg`;

    const imageURL = await hre.run("storage:url", { cid, path });

    console.log(imageURL.href);
  });

task("invite:premint", "Store the reserved invitation (#0000) asset")
  .addParam("assetFile", "Path to SVG membership card template", "./assets/3ID_NFT_CARD_NO_BG.svg", types.inputFile)
  .addParam("outputDir", "Location of generated asset files", OUTPUT_DIR)
  .setAction(async (taskArgs, hre) => {
    // Location of generated asset files.
    const outputDir = taskArgs.outputDir;

    // Get the API key for nft.storage.
    const storageKey = await hre.run("config:storageKey");

    // Ensure output directory exists.
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

    // This is written into the NFT metadata and indicates which batch
    // of invitations we're minting.
    const inviteTier = INVITE_TIER;

    // Returns ms since epoch if valid date string, or NaN if invalid
    // date string. We format it as an ISO 8601 date string in UTC.
    const issueDateParsed = Date.now();
    const issueDate = new Intl.DateTimeFormat('utc').format(issueDateParsed);

    const inviteId = "0000";

    // When parameter type is types.inputFile the existence of file is
    // validated already.
    const assetFile = taskArgs.assetFile;

    // Path the output SVG file that we will generate from the template.
    const outputFile = path.join("outputs", `invite-${inviteId}.svg`);

    // Write an SVG asset file as outputFile.
    const generateResult = await hre.run("invite:generate-nft-asset", {
      inviteId,
      issueDate,
      assetFile,
      outputFile
    });
    // Publish the generated asset to our storage provider.
    const publishResult = await hre.run("invite:publish-nft-storage", {
      storageKey,
      inviteId,
      inviteTier,
      issueDate,
      outputFile,
    });

    // The output URL should be entered into deploy.ts script for
    // injection into the contract when it is deployed.
    console.log(publishResult.url);
  });

task("invite:award", "Mint an invite for an account")
  .addOptionalParam("contract", "The invite contract address")
  .addParam("account", "The account address")
  .addParam("assetFile", "Path to SVG membership card template", "./assets/3ID_NFT_CARD_NO_BG.svg", types.inputFile)
  .addParam("outputDir", "Location of generated asset files", OUTPUT_DIR)
  .setAction(async (taskArgs, hre) => {
    // The invitation smart contract address.
    const contract = await hre.run("config:contract", { contract: taskArgs.contract });
    // The recipient address for the invitation.
    const account = await hre.run("config:account", { account: taskArgs.account });
    // Location of generated asset files.
    const outputDir = taskArgs.outputDir;

    // Get the API key for nft.storage.
    const storageKey = await hre.run("config:storageKey");

    // Ensure output directory exists.
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

    // This is written into the NFT metadata and indicates which batch
    // of invitations we're minting.
    const inviteTier = INVITE_TIER;

    // Returns ms since epoch if valid date string, or NaN if invalid
    // date string. We format it as an ISO 8601 date string in UTC.
    const issueDateParsed = Date.now();
    const issueDate = new Intl.DateTimeFormat('utc').format(issueDateParsed);

    // Get the tokenId of the next invitation.
    // **WARNING** potential race condition here!
    const nextInvite = await hre.run("call:nextInvite", { contract });
    // Token identifiers are integers in the range [0,1000). Convert to
    // a zero-padded 4-digit string.
    const inviteId = nextInvite.toString().padStart(4, "0");

    // When parameter type is types.inputFile the existence of file is
    // validated already.
    const assetFile = taskArgs.assetFile;

    // Path the output SVG file that we will generate from the template.
    const outputFile = path.join("outputs", `invite-${inviteId}.svg`);

    // Write an SVG asset file as outputFile.
    const generateResult = await hre.run("invite:generate-nft-asset", {
      inviteId,
      issueDate,
      assetFile,
      outputFile
    });
    // Publish the generated asset to our storage provider.
    const publishResult = await hre.run("invite:publish-nft-storage", {
      storageKey,
      inviteId,
      inviteTier,
      issueDate,
      outputFile,
    });
    // Call our contract to award the invite.
    const awardResult = await hre.run("call:awardInvite", {
      account,
      contract,
      tokenURI: publishResult.url,
    });

    console.log(chalk.red("AWARDED INVITE"));
    console.log(chalk.green("-> contract:"), contract);
    console.log(chalk.green("->  invitee:"), account);
    console.log(chalk.green("-> metadata:"), publishResult.url);
    console.log(chalk.green("->   invite:"), `#${inviteId}`);
    console.log(chalk.green("->   issued:"), `${issueDate}Z`);
    console.log(chalk.green("->     tier:"), inviteTier);
    console.log(chalk.green("->    asset:"), outputFile);
  });

// config
// -----------------------------------------------------------------------------

const config: HardhatUserConfig = {
  defaultNetwork: "localhost",
  solidity: "0.8.9",
  etherscan: {
    apiKey: `${ETHERSCAN.apiKey}`,
  },
  networks: {
    goerli: {
      // For optional validation.
      chainId: GOERLI_CHAIN_ID,
      url: NET_GOERLI.alchemy.appURL,
      // Account to use as the default sender. If not supplied, the
      // first account of the node is used.
      //from: "",
      accounts: [
        NET_GOERLI.wallet.privateKey,
      ],
    },
    /*
    mainnet: {
      // For optional validation.
      chainId: MAINNET_CHAIN_ID,
      url: NET_MAINNET.alchemy.appURL,
      // Account to use as the default sender. If not supplied, the
      // first account of the node is used.
      //from: "",
      accounts: [
        NET_MAINNET.wallet.privateKey,
      ],
    }
    */
  },
};

export default config;