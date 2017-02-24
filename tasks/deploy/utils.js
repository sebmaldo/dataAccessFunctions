const semverRegex = require('semver-regex');
const jsonfile 	  = require('jsonfile');

module.exports.isValidSemver = (versionString) => {
    return semverRegex().test(versionString);
};


module.exports.getNextVersion = (type, version) => {
    let otype = type.toLowerCase();
    let segments = version.split('.');

    if ('major' === otype) {
        segments[0] = parseInt(segments[0]) + 1;
        segments[1] = segments[2] = 0;
    }
	
    if ('minor' === otype) {
        segments[1] = parseInt(segments[1]) + 1;
        segments[2] = 0;
 	}

    if ('patch' === otype) {
        segments[2] = parseInt(segments[2]) + 1;
    }

    return segments.join('.');
};


module.exports.writeNewProps = (packageJsonPath, props, indent) => {
    jsonfile.spaces = indent || 4;

    let newProps = Object.keys(props);
    let pac = require(packageJsonPath);

    for (let prop of newProps) {
        pac[prop] = props[prop];
    }

    return jsonfile.writeFileSync(packageJsonPath, pac);
};
