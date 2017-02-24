const npath    = require('path');
const Promise  = require('bluebird');
const git      = require('nodegit');
const colors   = require('chalk');
const inquirer = require('inquirer');

const packageJSONPath = npath.join(npath.resolve(), 'package.json');
const version  = require(packageJSONPath).version;

const utils    = require('./utils');
const gitutils = require('./nodegit-utils');

exports = module.exports;

exports.deploy = Promise.coroutine(function *() {

    console.log(colors.cyan('\n Starting deploy process \n'));

    let passPrompt = yield inquirer.prompt([{
        type    : 'password',
        name    : 'passphrase',
        message : 'Insert your ssh passphrase (or press enter if don\'t use one):'
    }]);

    let passphrase = passPrompt.passphrase;

    // Open repo
    var repo = yield git.Repository.open(npath.join(npath.resolve(), '.git'));

    // @TODO - handle merge conflicts
    console.log(colors.cyan('\nPulling changes ...\n'));

    var pullCommitHash = yield gitutils.pullBranch(repo, 'master', passphrase);

    console.log(colors.white.bold(`- Pull success ${pullCommitHash} `), colors.green('✓\n'));

    // Ask for type of release version

    let release = yield inquirer.prompt([{
        type    : 'list',
        name    : 'type',
        message : 'Which kind of release do you want to deploy',
        choices : ['Patch', 'Minor', 'Major']
    }]);


    let newVersion = utils.getNextVersion(release.type, version);

    console.log(colors.cyan(`\nWriting version ${newVersion} to package.json ...\n`));

    utils.writeNewProps(packageJSONPath, {
        version: newVersion
    }, 4);

    console.log(colors.white.bold(`- Package.json now in version ${newVersion} `), colors.green('✓\n'));

    // @TODO - add npm run build
    let commitIdToTag;

    let commitId  = commitIdToTag = yield gitutils.addAndcommitAll(repo,
        `Versioning to ${newVersion} and building for production --skip-ci`
    );

    console.log(colors.white.bold(`- Changes commited to ${commitId} `), colors.green('✓\n'));

    // Push all changes from copy-prod

    console.log(colors.cyan('\n Pushing changes to master ...\n'));

    // @TODO - handle errors
    yield gitutils.push(repo, 'master', 'branch', passphrase);

    console.log(colors.white.bold(`- Push success - commit id ${commitId} to master branch `),
        colors.green('✓\n'));

    // Checkout release branch
    console.log(colors.cyan('\n Checking out release branch ...\n'));

    yield repo.checkoutBranch('release', {
        checkoutStrategy : git.Checkout.STRATEGY.FORCE
    });

    // TODO - handle errors

    currentBranchName = yield gitutils.getCurrenBranchName(repo);

    console.log(colors.white.bold(`- Checkout success, current branch [${currentBranchName}]`),
        colors.green('✓'));

    console.log(colors.cyan(`\n Pulling changes on  [${currentBranchName}]...\n`));

    let hash = yield gitutils.pullBranch(repo, 'release', passphrase);

    console.log(colors.white.bold(`- [${currentBranchName}] now is up to date, commit: [${hash}]`),
        colors.green('✓'));

    console.log(colors.cyan(`\n Checking out back to master branch ...\n`));

    yield repo.checkoutBranch('master', {
        checkoutStrategy : git.Checkout.STRATEGY.FORCE
    });

    currentBranchName = yield gitutils.getCurrenBranchName(repo);

    console.log(colors.white.bold(`- Checkout success, current branch [${currentBranchName}]`),
        colors.green('✓'));

    console.log(colors.cyan(`\n Merging branch master with latest release ...\n`));

    yield repo.mergeBranches('master', 'release');

    // TODO - handle errors

    console.log(colors.white.bold(`- Merge success, master is now merged with release`),
        colors.green('✓'));

    console.log(colors.cyan('\n Pushing changes to master ...\n'));

    // @TODO - handle errors
    yield gitutils.push(repo, 'master', 'branch', passphrase);

    console.log(colors.white.bold(`- Push success to master (merged with release)`),
        colors.green('✓\n'));

    console.log(colors.cyan('\n Checking out release branch ...\n'));

    yield repo.checkoutBranch('release', {
        checkoutStrategy : git.Checkout.STRATEGY.FORCE
    });

    // TODO - Handle errors
    currentBranchName = yield gitutils.getCurrenBranchName(repo);

    console.log(colors.white.bold(`- Checkout success, current branch [${currentBranchName}]`),
        colors.green('✓'));

    console.log(colors.cyan('\n Merging master into release branch ...\n'));

    yield repo.rebaseBranches('release', 'master');
    // yield repo.mergeBranches('release', 'master');

    let lastCommitToAmend = yield repo.getHeadCommit();
    let signature = git.Signature.now('Becual', 'tecnologia@becual.com');

    yield lastCommitToAmend.amend('HEAD', signature, signature, 'utf-8', `Version ${newVersion} (merge autodeploy task).`);

    // TODO - handle errors

    console.log(colors.white.bold(`- Merge with master done`), colors.green('✓'));

    console.log(colors.cyan('\n Pushing changes (from merge) to release ...\n'));

    yield gitutils.push(repo, 'release', 'branch', passphrase);

    // TODO - handle errors

    console.log(colors.white.bold(`- Push success to release (rebased with master)`),
        colors.green('✓\n'));

    let tagPrompt = yield inquirer.prompt([{
        type    : 'input',
        name    : 'description',
        message : 'Tag description',
        default : function () {
            return `v${newVersion} released!`;
        }
    }]);


    let lastCommit = yield repo.getHeadCommit();

    console.log(colors.cyan(`\n Creating tag v${newVersion} on release branch...\n`));
    // lastCommit.id()
    yield gitutils.createAndPushTag(repo, commitIdToTag, `${newVersion}`,
        tagPrompt.description, passphrase);

    console.log(colors.white.bold(`- Tag v${newVersion} created and pushed to release branch`),
        colors.green('✓\n'));

    console.log(colors.cyan(`\n Checking out to master...\n`));

    yield repo.checkoutBranch('master', {
        checkoutStrategy : git.Checkout.STRATEGY.FORCE
    });


    console.log(colors.white.bold(`- Checkout success, current branch [${currentBranchName}]`),
        colors.green('✓'));

    yield repo.mergeBranches('master', 'release');

    yield gitutils.addAndcommitAll(repo, 'Merge to latest release (autodeploy) --skip-ci');

    yield gitutils.push(repo, 'master', 'branch', passphrase);

    currentBranchName = yield gitutils.getCurrenBranchName(repo);

    console.log(colors.white.bold(`- Checkout success, current branch [${currentBranchName}]`),
        colors.green('✓'));
});


exports.preDeploy = Promise.coroutine(function *() {

    console.log(colors.cyan('\nValidating prerequisites to deploy ... \n'));

    // Semantic versioning check
    if (!utils.isValidSemver(version)) {
        console.log(colors.red('Your project package.json version isn\'t compilant with semver!'));
        console.log(colors.white.bold('Please refer to http://semver.org/'));
        process.exit();
    }

    console.log(colors.white.bold('- Project version compliant with semver'), colors.green('✓'));

    console.log(colors.cyan('\nOpening git Repository ...'));

    var repo = yield git.Repository.open(npath.join(npath.resolve(), '.git'));
    var currentBranchName = yield gitutils.getCurrenBranchName(repo);

    // Check that the current active branch is master

    console.log(colors.cyan('\nCurrent branch is '), colors.white.bold(`${currentBranchName}\n`));

    if (currentBranchName !== 'master') {
        console.log(colors.red(`Active branch must be master to deploy, current is [${currentBranchName}]\n`));
        process.exit();
    }

    console.log(colors.white.bold('- Active master branch'), colors.green('✓'));

    // Checking repo status (changes)

    console.log(colors.cyan('\nPerforming git status ...\n'));

    let status = yield repo.getStatus();

    if (status.length) {
        console.log(colors.red('You must add, commit and merge all your changes with master before deploy!'));
        process.exit();
    }

    console.log(colors.white.bold('- No pending changes '), colors.green('✓'));
});