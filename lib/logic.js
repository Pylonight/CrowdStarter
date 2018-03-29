'use strict';
/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * transaction Pledge, where backers pledge selected amount of tokens to the project.
 * @param {org.crowdstarter.pylonia.Pledge} pledge - the Pledge transaction
 * @transaction
 */
function pledge(pledge) {
    // safe check
    if (pledge === null) {
        throw new Error('Invalid pledge operation');
    }
    var project = pledge.backedProject;
    if (project === null) {
        throw new Error('Invalid pledge operation');
    }
    var backer = pledge.backer;
    if (backer === null) {
        throw new Error('Invalid pledge operation');
    }
    var value = pledge.value;
    if (value === null || value === 0) {
        throw new Error('Invalid pledge operation');
    }

    // check whether the project is active, says raising funds
    if (project.state !== 'ACTIVE') {
        throw new Error('Project is not active');
    }

    // check whether the project should be closed
    // TODO: consider how to integrate time check
    if (false) {
        throw new Error('Project is being closed');
    }

    // check the balance of backer against pledge amount
    if (backer.balance < value) {
        throw new Error('Backer does not have enough tokens')
    }

    // backer pledges to the project
    // update the balance of backer
    console.log('#### backer balance before: '+backer.balance);
    backer.balance -= value;
    console.log('#### backer balance after: '+backer.balance);
    // update the balance of project
    console.log('#### project balance before: '+project.balance);
    project.balance += value;
    console.log('#### project balance after: '+project.balance);

    // update backer info
    backer.backedProject.push(project);

    // update project info
    project.backers.push(backer);

    return getAssetRegistry('org.crowdstarter.pylonia.Backer')
        .then(function(backerRegistry) {
            // save the backed projects of backer
            return backerRegistry.update(backer);
        })
        .then(function() {
            return getAssetRegistry('org.crowdstarter.pylonia.Project')
        })
        .then(function(projectRegistry) {
            // save the backers of project
            return projectRegistry.update(project);
        });
    /*var assetRegistry;
    var id = changeAssetValue.relatedAsset.assetId;
    return getAssetRegistry('org.crowdstarter.pylonia.SampleAsset')
        .then(function(ar) {
            assetRegistry = ar;
            return assetRegistry.get(id);
        })
        .then(function(asset) {
            asset.value = changeAssetValue.newValue;
            return assetRegistry.update(asset);
        });*/
}



/**
 * transaction Refund, where project fails to raise enough funds against the goal.
 * Backers will get their tokens back.
 * @param {org.crowdstarter.pylonia.Refund} refund - the Refund transaction
 * @transaction
 */
function refund(refund) {
    // safe check
    if (refund === null) {
        throw new Error('Invalid refund operation');
    }
    var project = pledge.backedProject;
    if (project === null) {
        throw new Error('Invalid refund operation');
    }

    // check whether the project is already closed
    if (project.state === 'CLOSED') {
        throw new Error('Project is already closed');
    }

    // check whether the project should be closed
    // TODO: consider how to integrate time check
    if (false) {
        throw new Error('Project is still active, should not be closed');
    }

    // refund to every backer
    project.backers.forEach(backer => {
        // backer pledges to the project
        // update the balance of backer
        console.log('#### backer balance before: '+backer.balance);
        backer.balance -= value;
        console.log('#### backer balance after: '+backer.balance);
        // update the balance of project
        console.log('#### project balance before: '+project.balance);
        project.balance += value;
        console.log('#### project balance after: '+project.balance);
    });

    // update backer info
    backer.backedProject.push(project);

    // update project info
    project.backers = [];
    project.state = 'CLOSED';

    return getAssetRegistry('org.crowdstarter.pylonia.Project')
        .then(function(projectRegistry) {
            // save state of project
            return projectRegistry.update(project);
        });
}