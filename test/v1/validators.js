const Validators = artifacts.require('cache/solpp-generated-contracts/v1/Validators.sol:Validators');
const VotePool = artifacts.require('MockVotePool');
const Punish = artifacts.require('MockPunish');

const {assert} = require('hardhat');
const truffleAssert = require('truffle-assertions');
const {web3, BN} = require('@openzeppelin/test-helpers/src/setup');

const Pos = 0
const Poa = 1

contract("Validators test", accounts => {
    let validators;
    let punish;

    before('deploy validator', async () => {
        validators = await Validators.new()
        punish = await Punish.new()
    })

    before('init validator', async () => {
        await validators.initialize(accounts.slice(10, 15), accounts.slice(10, 15), accounts[1], {gas: 12450000})
        assert.equal(await validators.admin(), accounts[1])

        let vals = await validators.getTopValidators()
        assert.equal(vals.length, 5, 'validator length')
    })

    it('only admin', async () => {
        let inputs = [
            ['changeAdmin', [accounts[0]]],
            ['updateParams', [11, 10, 10, 11]],
            ['addValidator', [accounts[0], accounts[0], 20, Pos]],
            ['updateValidatorState', [accounts[0], true]]
        ]

        for (let input of inputs) {
            try {
                await validators[input[0]](...input[1], {from: accounts[0]})
            } catch (e) {
                assert(e.message.search('Only admin') >= 0, input[0])
            }
        }
    })

    it('change admin', async () => {
        let tx = await validators.changeAdmin(accounts[0], {from: accounts[1]})
        truffleAssert.eventEmitted(tx, 'ChangeAdmin', {admin: accounts[0]})
        assert.equal(await validators.admin(), accounts[0])
    })

    it('change params', async () => {
        //params incorrect
        try {
            await validators.updateParams(1, 1, 1, 1, {from: accounts[0]})
        } catch (e) {
            assert(e.message.search('Invalid counts') >= 0, 'invalid count')
        }

        let tx = await validators.updateParams(20, 20, 1, 1, {from: accounts[0]})

        truffleAssert.eventEmitted(tx, 'UpdateParams', ev => ev.posCount.toNumber() === 20
            && ev.posBackup.toNumber() === 20
            && ev.poaCount.toNumber() === 1
            && ev.poaBackup.toNumber() === 1)

        assert.equal((await validators.count(Pos)).toNumber(), 20, 'pos count')
        assert.equal((await validators.count(Poa)).toNumber(), 1, 'poa count')
        assert.equal((await validators.backupCount(Pos)).toNumber(), 20, 'pos backup count')
        assert.equal((await validators.backupCount(Poa)).toNumber(), 1, 'poa backup count')
    })

    it("get top validators", async () => {
        let vals = await validators.getTopValidators()
        assert.equal(vals.length, 1, 'validator length')
    })

    it("add validator", async () => {
        let tx = await validators.addValidator(accounts[0], accounts[0], 10, Pos, {
            from: accounts[0],
            gas: 4000000
        })

        truffleAssert.eventEmitted(tx, 'AddValidator', {
            validator: accounts[0],
            votePool: await validators.votePools(accounts[0])
        })

        assert(tx.receipt.status)
    })

    it('only registered', async () => {
        let c = await VotePool.new(accounts[0], accounts[0], 0, 1)
        await c.changeVote(50)
        try {
            await c.changeVoteAndRanking(await validators.address, 100)
        } catch (e) {
            assert(e.message.search('Vote pool not registered') >= 0, "change vote to 100")
        }

        try {
            await c.changeVoteAndRanking(await validators.address, 0)
        } catch (e) {
            assert(e.message.search('Vote pool not registered') >= 0, "change vote to 0")
        }
    })

    it('updateActiveValidatorSet', async () => {
        let vals = await validators.getTopValidators()
        await validators.updateActiveValidatorSet(vals, 200)
        assert.equal((await validators.getActiveValidators()).length, 1, 'active validators length')
        assert.equal((await validators.getBackupValidators()).length, 1, 'backup validators length')
    })
});
