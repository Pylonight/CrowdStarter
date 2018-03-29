'use strict';
/**
 * Mocha Unit Tests
 */

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const IdCard = require('composer-common').IdCard;
const MemoryCardStore = require('composer-common').MemoryCardStore;

const path = require('path');

require('chai').should();

const namespace = 'org.crowdstarter.pylonia';

describe('CrowdStarter#' + namespace, () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = new MemoryCardStore();
    let adminConnection;
    let businessNetworkConnection;

    before(() => {
        // Embedded connection used for local testing
        const connectionProfile = {
            name: 'embedded',
            type: 'embedded'
        };
        // Embedded connection does not need real credentials
        const credentials = {
            certificate: 'FAKE CERTIFICATE',
            privateKey: 'FAKE PRIVATE KEY'
        };

        // PeerAdmin identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const deployerCardName = 'PeerAdmin';
        adminConnection = new AdminConnection({ cardStore: cardStore });

        return adminConnection.importCard(deployerCardName, deployerCard).then(() => {
            return adminConnection.connect(deployerCardName);
        });
    });

    beforeEach(() => {
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

        const adminUserName = 'admin';
        let adminCardName;
        let businessNetworkDefinition;

        return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..')).then(definition => {
            businessNetworkDefinition = definition;
            // Install the Composer runtime for the new business network
            return adminConnection.install(businessNetworkDefinition.getName());
        }).then(() => {
            // Start the business network and configure an network admin identity
            const startOptions = {
                networkAdmins: [
                    {
                        userName: adminUserName,
                        enrollmentSecret: 'adminpw'
                    }
                ]
            };
            return adminConnection.start(businessNetworkDefinition, startOptions);
        }).then(adminCards => {
            // Import the network admin identity for us to use
            adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
            return adminConnection.importCard(adminCardName, adminCards.get(adminUserName));
        }).then(() => {
            // Connect to the business network using the network admin identity
            return businessNetworkConnection.connect(adminCardName);
        });
    });

    describe('Pledge()', () => {
        it('Alice pledges to Odin Sphere', () => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create participants
            const backer = factory.newResource(namespace, 'Backer', 'alice@gmail.com');
            backer.firstName = 'Alice';
            backer.lastName = 'Heart'
            backer.balance = 10000;

            const creator = factory.newResource(namespace, 'Creator', 'vanilla@va.jp');
            creator.firstName = 'Vanilla';
            creator.lastName = 'Ware';
            creator.balance = 1000;

            // Create assets
            const project = factory.newResource(namespace, 'Project', 'Proj0001');
            project.title = 'Odin Sphere';
            project.description = '2D';
            project.goal = 10000;
            project.balance = 0;
            project.state = 'ACTIVE';
            project.creator = factory.newRelationship(namespace, 'Creator', creator.$identifier);

            // Create a transaction to change the asset's value property
            const pledge = factory.newTransaction(namespace, 'Pledge');
            pledge.value = 5000;
            pledge.backedProject = factory.newRelationship(namespace, 'Project', project.$identifier);
            pledge.backer = factory.newRelationship(namespace, 'Backer', backer.$identifier);

            let creatorRegistryGlobal;
            let backerRegistryGlobal;
            let projectRegistryGlobal;

            return businessNetworkConnection.getParticipantRegistry(namespace + '.Creator')
                .then((creatorRegistry) => {
                    creatorRegistryGlobal = creatorRegistry;
                    return creatorRegistry.add(creator);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Backer');
                })
                .then((backerRegistry) => {
                    backerRegistryGlobal = backerRegistry;
                    return backerRegistry.add(backer);
                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Project');
                })
                .then((projectRegistry) => {
                    projectRegistryGlobal = projectRegistry;
                    return projectRegistry.add(project);
                })
                .then(() => {
                    return businessNetworkConnection.submitTransaction(pledge);
                })
                .then(() => {
                    return backerRegistryGlobal.get(backer.$identifier);
                })
                .then((thisBacker) => {
                    thisBacker.balance.should.equal(5000);
                    thisBacker.pledges.length.should.equal(1);
                    thisBacker.pledges[0].value.should.equal(5000);
                })
                .then(() => {
                    return projectRegistryGlobal.get(project.$identifier);
                })
                .then((thisProject) => {
                    thisProject.balance.should.equal(5000);
                    thisProject.pledges.length.should.equal(1);
                    thisProject.pledges[0].value.should.equal(5000);
                });
        });
    });

    describe('Close()', () => {
        it('Alice and Bob pledge to Odin Sphere, and it meets the goal', () => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create participants
            const backer = factory.newResource(namespace, 'Backer', 'alice@gmail.com');
            backer.firstName = 'Alice';
            backer.lastName = 'Heart'
            backer.balance = 10000;
            const backer2 = factory.newResource(namespace, 'Backer', 'bob@hotmail.com');
            backer2.firstName = 'Bob';
            backer2.lastName = 'Spade'
            backer2.balance = 30000;

            const creator = factory.newResource(namespace, 'Creator', 'vanilla@va.jp');
            creator.firstName = 'Vanilla';
            creator.lastName = 'Ware';
            creator.balance = 1000;

            // Create assets
            const project = factory.newResource(namespace, 'Project', 'Proj0001');
            project.title = 'Odin Sphere';
            project.description = '2D';
            project.goal = 10000;
            project.balance = 0;
            project.state = 'ACTIVE';
            project.creator = factory.newRelationship(namespace, 'Creator', creator.$identifier);

            // Create a transaction to change the asset's value property
            const pledge = factory.newTransaction(namespace, 'Pledge');
            pledge.value = 5000;
            pledge.backedProject = factory.newRelationship(namespace, 'Project', project.$identifier);
            pledge.backer = factory.newRelationship(namespace, 'Backer', backer.$identifier);

            const pledge2 = factory.newTransaction(namespace, 'Pledge');
            pledge2.value = 8000;
            pledge2.backedProject = factory.newRelationship(namespace, 'Project', project.$identifier);
            pledge2.backer = factory.newRelationship(namespace, 'Backer', backer2.$identifier);

            const close = factory.newTransaction(namespace, 'Close');
            close.backedProject = factory.newRelationship(namespace, 'Project', project.$identifier);

            let creatorRegistryGlobal;
            let backerRegistryGlobal;
            let projectRegistryGlobal;

            return businessNetworkConnection.getParticipantRegistry(namespace + '.Creator')
                .then((creatorRegistry) => {
                    creatorRegistryGlobal = creatorRegistry;
                    return creatorRegistry.add(creator);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Backer');
                })
                .then((backerRegistry) => {
                    backerRegistryGlobal = backerRegistry;
                    return backerRegistry.add(backer);
                })
                .then(() => {
                    return backerRegistryGlobal.add(backer2);
                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Project');
                })
                .then((projectRegistry) => {
                    projectRegistryGlobal = projectRegistry;
                    return projectRegistry.add(project);
                })
                .then(() => {
                    return businessNetworkConnection.submitTransaction(pledge);
                })
                .then(() => {
                    return backerRegistryGlobal.get(backer.$identifier);
                })
                .then((thisBacker) => {
                    thisBacker.balance.should.equal(5000);
                    thisBacker.pledges.length.should.equal(1);
                    thisBacker.pledges[0].value.should.equal(5000);
                })
                .then(() => {
                    return projectRegistryGlobal.get(project.$identifier);
                })
                .then((thisProject) => {
                    thisProject.balance.should.equal(5000);
                    thisProject.pledges.length.should.equal(1);
                    thisProject.pledges[0].value.should.equal(5000);
                })
                .then(() => {
                    return businessNetworkConnection.submitTransaction(pledge2);
                })
                .then(() => {
                    return backerRegistryGlobal.get(backer2.$identifier);
                })
                .then((thisBacker) => {
                    thisBacker.balance.should.equal(22000);
                    thisBacker.pledges.length.should.equal(1);
                    thisBacker.pledges[0].value.should.equal(8000);
                })
                .then(() => {
                    return projectRegistryGlobal.get(project.$identifier);
                })
                .then((thisProject) => {
                    thisProject.balance.should.equal(13000);
                    thisProject.pledges.length.should.equal(2);
                    thisProject.pledges[1].value.should.equal(8000);
                })
                .then(() => {
                    return businessNetworkConnection.submitTransaction(close);
                })
                .then(() => {
                    return backerRegistryGlobal.get(backer.$identifier);
                })
                .then((thisBacker) => {
                    thisBacker.balance.should.equal(5000);
                    thisBacker.pledges.length.should.equal(1);
                    thisBacker.pledges[0].value.should.equal(5000);
                })
                .then(() => {
                    return backerRegistryGlobal.get(backer2.$identifier);
                })
                .then((thisBacker) => {
                    thisBacker.balance.should.equal(22000);
                    thisBacker.pledges.length.should.equal(1);
                    thisBacker.pledges[0].value.should.equal(8000);
                })
                .then(() => {
                    return projectRegistryGlobal.get(project.$identifier);
                })
                .then((thisProject) => {
                    thisProject.state.should.equal('CLOSED');
                    thisProject.balance.should.equal(0);
                    thisProject.pledges.length.should.equal(2);
                    thisProject.pledges[0].value.should.equal(5000);
                    thisProject.pledges[1].value.should.equal(8000);
                })
        });

        it('Alice and Bob pledge to Odin Sphere, and it fails the goal', () => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create participants
            const backer = factory.newResource(namespace, 'Backer', 'alice@gmail.com');
            backer.firstName = 'Alice';
            backer.lastName = 'Heart'
            backer.balance = 10000;
            const backer2 = factory.newResource(namespace, 'Backer', 'bob@hotmail.com');
            backer2.firstName = 'Bob';
            backer2.lastName = 'Spade'
            backer2.balance = 30000;

            const creator = factory.newResource(namespace, 'Creator', 'vanilla@va.jp');
            creator.firstName = 'Vanilla';
            creator.lastName = 'Ware';
            creator.balance = 1000;

            // Create assets
            const project = factory.newResource(namespace, 'Project', 'Proj0001');
            project.title = 'Odin Sphere';
            project.description = '2D';
            project.goal = 10000;
            project.balance = 0;
            project.state = 'ACTIVE';
            project.creator = factory.newRelationship(namespace, 'Creator', creator.$identifier);

            // Create a transaction to change the asset's value property
            const pledge = factory.newTransaction(namespace, 'Pledge');
            pledge.value = 5000;
            pledge.backedProject = factory.newRelationship(namespace, 'Project', project.$identifier);
            pledge.backer = factory.newRelationship(namespace, 'Backer', backer.$identifier);

            const pledge2 = factory.newTransaction(namespace, 'Pledge');
            pledge2.value = 4000;
            pledge2.backedProject = factory.newRelationship(namespace, 'Project', project.$identifier);
            pledge2.backer = factory.newRelationship(namespace, 'Backer', backer2.$identifier);

            const close = factory.newTransaction(namespace, 'Close');
            close.backedProject = factory.newRelationship(namespace, 'Project', project.$identifier);

            let creatorRegistryGlobal;
            let backerRegistryGlobal;
            let projectRegistryGlobal;

            return businessNetworkConnection.getParticipantRegistry(namespace + '.Creator')
                .then((creatorRegistry) => {
                    creatorRegistryGlobal = creatorRegistry;
                    return creatorRegistry.add(creator);
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Backer');
                })
                .then((backerRegistry) => {
                    backerRegistryGlobal = backerRegistry;
                    return backerRegistry.add(backer);
                })
                .then(() => {
                    return backerRegistryGlobal.add(backer2);
                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Project');
                })
                .then((projectRegistry) => {
                    projectRegistryGlobal = projectRegistry;
                    return projectRegistry.add(project);
                })
                .then(() => {
                    return businessNetworkConnection.submitTransaction(pledge);
                })
                .then(() => {
                    return backerRegistryGlobal.get(backer.$identifier);
                })
                .then((thisBacker) => {
                    thisBacker.balance.should.equal(5000);
                    thisBacker.pledges.length.should.equal(1);
                    thisBacker.pledges[0].value.should.equal(5000);
                })
                .then(() => {
                    return projectRegistryGlobal.get(project.$identifier);
                })
                .then((thisProject) => {
                    thisProject.balance.should.equal(5000);
                    thisProject.pledges.length.should.equal(1);
                    thisProject.pledges[0].value.should.equal(5000);
                })
                .then(() => {
                    return businessNetworkConnection.submitTransaction(pledge2);
                })
                .then(() => {
                    return backerRegistryGlobal.get(backer2.$identifier);
                })
                .then((thisBacker) => {
                    thisBacker.balance.should.equal(26000);
                    thisBacker.pledges.length.should.equal(1);
                    thisBacker.pledges[0].value.should.equal(4000);
                })
                .then(() => {
                    return projectRegistryGlobal.get(project.$identifier);
                })
                .then((thisProject) => {
                    thisProject.balance.should.equal(9000);
                    thisProject.pledges.length.should.equal(2);
                    thisProject.pledges[1].value.should.equal(4000);
                })
                .then(() => {
                    return businessNetworkConnection.submitTransaction(close);
                })
                .then(() => {
                    return backerRegistryGlobal.get(backer.$identifier);
                })
                .then((thisBacker) => {
                    thisBacker.balance.should.equal(10000);
                    thisBacker.pledges.length.should.equal(0);
                })
                .then(() => {
                    return backerRegistryGlobal.get(backer2.$identifier);
                })
                .then((thisBacker) => {
                    thisBacker.balance.should.equal(30000);
                    thisBacker.pledges.length.should.equal(0);
                })
                .then(() => {
                    return projectRegistryGlobal.get(project.$identifier);
                })
                .then((thisProject) => {
                    thisProject.state.should.equal('CLOSED');
                    thisProject.balance.should.equal(0);
                    thisProject.pledges.length.should.equal(0);
                })
        });
    });
});
