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
    console.log('#### backer '+project.title+' balance before: '+backer.balance);
    backer.balance -= value;
    console.log('#### backer '+project.title+' balance after: '+backer.balance);
    // update the balance of project
    console.log('#### project '+backer.email+' balance before: '+project.balance);
    project.balance += value;
    console.log('#### project '+backer.email+' balance after: '+project.balance);

    // update backer info
    backer.pledges.push(pledge);

    // update project info
    project.pledges.push(pledge);

    return getParticipantRegistry('org.crowdstarter.pylonia.Backer')
        .then(function(backerRegistry) {
            // save the backed projects of backer
            return backerRegistry.update(backer);
        })
        .then(function() {
            return getAssetRegistry('org.crowdstarter.pylonia.Project');
        })
        .then(function(projectRegistry) {
            // save the backers of project
            return projectRegistry.update(project);
        });
}



/**
 * transaction Close, where project fails to raise enough funds against the goal.
 * Backers will get their tokens back. OR,
 * project raises enough funds to the goal. Tokens will be transferred to creator.
 * @param {org.crowdstarter.pylonia.Close} close - the Close transaction
 * @transaction
 */
function close(close) {
    // safe check
    if (close === null) {
        throw new Error('Invalid close operation');
    }
    var project = close.backedProject;
    if (project === null) {
        throw new Error('Invalid close operation');
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

    // whether it succeeds to raise enough funds
    if (project.balance < project.goal) {
        // failure

        var backers = []
        // refund to every backer
        project.pledges.forEach(pledge => {
            // backer gets tokens back from the project
            // update the balance of project
            console.log('#### project '+project.title+' balance before: '+project.balance);
            project.balance -= pledge.value;
            console.log('#### project '+project.title+' balance after: '+project.balance);
            // update the balance of backer
            console.log('#### backer '+pledge.backer.email+' balance before: '+pledge.backer.balance);
            pledge.backer.balance += pledge.value;
            console.log('#### backer '+pledge.backer.email+' balance after: '+pledge.backer.balance);
            // update backer pledges info
            pledge.backer.pledges.splice(pledge.backer.pledges.indexOf(pledge), 1);
            backers.push(pledge.backer);
        });

        // update project info
        project.pledges = [];
        project.state = 'CLOSED';

        return getAssetRegistry('org.crowdstarter.pylonia.Project')
            .then(function(projectRegistry) {
                // save state of project
                return projectRegistry.update(project);
            })
            .then(function() {
                return getParticipantRegistry('org.crowdstarter.pylonia.Backer');
            })
            .then(function(backerRegistry) {
                // save the backers of project
                return backerRegistry.updateAll(backers);
            });
    } else {
        // success

        // update project info
        project.state = 'CLOSED';

        var value = project.balance;
        // update the balance of project
        console.log('#### project '+project.title+' balance before: '+project.balance);
        project.balance = 0;
        console.log('#### project '+project.title+' balance after: '+project.balance);
        // update the balance of backer
        console.log('#### creator '+project.creator.email+' balance before: '+project.creator.balance);
        project.creator.balance += value;
        console.log('#### creator '+project.creator.email+' balance after: '+project.creator.balance);
    
        return getAssetRegistry('org.crowdstarter.pylonia.Project')
            .then(function(projectRegistry) {
                // save state of project
                return projectRegistry.update(project);
            })
            .then(function() {
                return getParticipantRegistry('org.crowdstarter.pylonia.Creator');
            })
            .then(function(creatorRegistry) {
                // save the backers of project
                return creatorRegistry.update(project.creator);
            });
    }
}