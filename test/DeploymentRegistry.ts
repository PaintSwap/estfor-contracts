import {expect} from "chai";
import {
  CONTRACT_NAMES,
  EXTERNAL_NAMES,
  getContractAddress,
  getDeploymentIsBeta,
  getSelectedDeploymentId,
  loadDeploymentRegistry,
  validateDeploymentRegistry,
} from "../scripts/deploymentRegistry";

describe("DeploymentRegistry", function () {
  it("loads both Sonic deployments by explicit ID", function () {
    const live = loadDeploymentRegistry("sonic-live");
    const beta = loadDeploymentRegistry("sonic-beta");

    expect(live.chainId).to.equal(146);
    expect(live.profile).to.equal("live");
    expect(getContractAddress(live, "shop")).to.equal("0x80b78e431b6e52027debe297cd8ba614820a2f1b");
    expect(beta.chainId).to.equal(146);
    expect(beta.profile).to.equal("beta");
    expect(getContractAddress(beta, "shop")).to.equal("0xb3778f2c24d94e3c7cfe608388bd35bba9401caa");
    expect(getDeploymentIsBeta({DEPLOYMENT_ID: "sonic-live"})).to.equal(false);
    expect(getDeploymentIsBeta({DEPLOYMENT_ID: "sonic-beta"})).to.equal(true);
  });

  it("contains every compatibility contract and external address", function () {
    for (const deploymentId of ["sonic-live", "sonic-beta"]) {
      const deployment = loadDeploymentRegistry(deploymentId);
      expect(Object.keys(deployment.contracts)).to.have.members([...CONTRACT_NAMES]);
      expect(Object.keys(deployment.externals)).to.have.members([...EXTERNAL_NAMES]);
      expect(deployment.authority).to.deep.equal({
        type: "safe",
        address: "0xC7073F6317813C3EDB09FA2d19A6cA259A9d4aD9",
      });
    }
  });

  it("requires an explicit deployment ID", function () {
    expect(() => getSelectedDeploymentId({})).to.throw("DEPLOYMENT_ID is required");
    expect(getSelectedDeploymentId({DEPLOYMENT_ID: "sonic-live"})).to.equal("sonic-live");
  });

  it("rejects unknown deployments and path traversal", function () {
    expect(() => loadDeploymentRegistry("unknown")).to.throw('Unknown deployment "unknown"');
    expect(() => loadDeploymentRegistry("../sonic-live")).to.throw('Invalid deployment ID "../sonic-live"');
  });

  it("rejects non-Safe authority and incomplete contract registries", function () {
    const live = loadDeploymentRegistry("sonic-live");
    const nonSafe = structuredClone(live) as unknown as Record<string, unknown>;
    (nonSafe.authority as Record<string, unknown>).type = "eoa";
    expect(() => validateDeploymentRegistry(nonSafe)).to.throw('authority.type must be "safe"');

    const incomplete = structuredClone(live) as unknown as Record<string, unknown>;
    delete (incomplete.contracts as Record<string, unknown>).shop;
    expect(() => validateDeploymentRegistry(incomplete)).to.throw("contracts.shop must be an object");
  });
});
