import {MerkleTree} from "merkletreejs";
import {utils} from "ethers";

export class MerkleTreeWhitelist {
  merkleTree: MerkleTree;

  constructor(whitelistAddresses: string[]) {
    const leafNodes = this.getLeafNodes(whitelistAddresses);
    this.merkleTree = new MerkleTree(leafNodes, utils.keccak256, {sortPairs: true});
  }

  getLeafNodes(whitelistAddresses: string[]) {
    return whitelistAddresses.map((addr) => utils.keccak256(addr));
  }

  verify(proof: string[], address: string, root: Buffer) {
    return this.merkleTree.verify(proof, utils.keccak256(address), root);
  }

  getProof(address: string) {
    return this.merkleTree.getHexProof(utils.keccak256(address));
  }

  getRoot() {
    return this.merkleTree.getRoot();
  }
}
