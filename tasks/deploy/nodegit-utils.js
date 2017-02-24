const git      = require('nodegit');

// Get user home directory (Windows, OSX, Linux compatible)
const HOME     = process.env.HOME || process.env.USERPROFILE;

// global push
let push = null;

// Shorthand for module.exports
exports = module.exports;


/**
 * Get a function which retrieve SSH credentials
 * to have access to git repository (http://www.nodegit.org/api/cred/#sshKeyNew)
 */

function getSshCredentials(passphrase) {
    return (url, userName) => {
        return git.Cred.sshKeyNew(
            userName,
            `${HOME}/.ssh/id_rsa.pub`,
            `${HOME}/.ssh/id_rsa`,
            passphrase || ''
        );
    };
}

/**
 * Get current git branch name
 * @param {nodegit.Repository} repo - The nodegit repository  instance
 * @returns {Promise}  a promise wich resolve the repo name or throw an error
 */

exports.getCurrenBranchName = function (repo) {
    return repo.getCurrentBranch()
        .then( branch => {
            return branch.name().match(/\/([^/]*)$/)[1];
        });
};


/**
 * Git Pull (retrieve changes from remote)
 * @param {nodegit.Repository} repo - The nodegit repository  instance
 * @param {String} branchName - The name of the branch to be pulled
 * @returns {Promise}  a promise wich resolve when content was updated an remote was merged with local
 */

exports.pullBranch = function (repo, branchName, passphrase) {
    return repo.fetch('origin',  {
        callbacks : {
            credentials : getSshCredentials(passphrase),
            certificateCheck : () => 1
        }
    })
    .then(() => {
        return repo.mergeBranches(`${branchName}`, `origin/${branchName}`);
    });
};


/**
 * Git push  (send changes to remote)
 * @param {nodegit.Repository} repo - The nodegit repository  instance
 * @param {String} remoteName - The name of the remote (can be a branch name or  tag)
 * @param {String} type - The type of the remote [branch, tag]
 * @returns {Promise}  a promise wich resolve when the new content was uploaded  to the remote branch
 */

exports.push = push = function (repo, remoteName, type, passphrase) {
    var refs = [];
    if ('tag' === type) {
        refs.push(`refs/tags/${remoteName}`);
    }

    if ('branch' === type) {
        refs.push(`refs/heads/${remoteName}:refs/heads/${remoteName}`);
    }

    return repo.getRemote('origin')
        .then(remote => {
            return remote.push(refs, {
                callbacks : {
                    credentials : getSshCredentials(passphrase)
                }
            });
        });
};



/**
 * Git Create Tag and Push to remote
 * @param {nodegit.Repository} repo - The nodegit repository  instance
 * @param {nodegit.oid} commitId - The id of the commit from where you want create a tag
 * @param {String} tagVersion - The version or name of the tag
 * @returns {Promise}  a promise wich resolve when the tag was created and pushed to remote origin
 */

exports.createAndPushTag = function (repo, commitId, tagVersion, message, passphrase) {
    return repo.createTag(commitId, `v${tagVersion}`, message)
        .then(() => {
            return push(repo, `v${tagVersion}`, 'tag', passphrase);
        });
};


/**
 * Get add . and commit changes
 * @param {nodegit.Repository} repo - The nodegit repository  instance
 * @param {String} message - The commit message
 * @returns {Promise}  a promise wich resolve the commit id
 */

exports.addAndcommitAll = function (repo, message) {
    let oid = null;
    let parent = null;
    let index = null;

    return repo.refreshIndex()
        .then(idx => {
            index = idx;
            return index.addAll();
        })
        .then(() => {
            return index.write();
        })
        .then(() => {
            return index.writeTree();
        })
        .then(oId => {
            oid = oId;
            return git.Reference.nameToId(repo, 'HEAD');
        })
        .then(head => {
            return repo.getCommit(head);
        })
        .then(prnt => {
            parent = prnt;
            return git.Signature.default(repo);
        })
        .then(author => {
            return repo.createCommit('HEAD', author, author, message, oid, [parent]);
        });
};