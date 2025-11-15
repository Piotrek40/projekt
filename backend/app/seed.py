"""
Seed data for the default fantasy campaign
"The Shadow of Thornhaven" - A dark fantasy story with moral choices
"""
from sqlalchemy.orm import Session
from . import models


def seed_campaign(db: Session):
    """
    Create the default campaign with all locations, NPCs, and narrative nodes
    """
    # Check if campaign already exists
    existing = db.query(models.Campaign).filter(models.Campaign.name == "The Shadow of Thornhaven").first()
    if existing:
        print("Campaign 'The Shadow of Thornhaven' already exists. Skipping seed.")
        return

    print("Seeding campaign: The Shadow of Thornhaven...")

    # Create Campaign
    campaign = models.Campaign(
        name="The Shadow of Thornhaven",
        description="A dark fantasy tale of plague, sacrifice, and difficult moral choices in the cursed village of Thornhaven."
    )
    db.add(campaign)
    db.flush()

    # Create Locations
    village_square = models.Location(
        campaign_id=campaign.id,
        name="Village Square",
        description="The heart of Thornhaven, now eerily quiet. The plague has taken its toll."
    )
    temple = models.Location(
        campaign_id=campaign.id,
        name="Old Temple",
        description="An ancient temple dedicated to forgotten gods. Dark energy emanates from within."
    )
    forest = models.Location(
        campaign_id=campaign.id,
        name="Cursed Forest",
        description="The forest that surrounds Thornhaven. Strange lights flicker between the trees."
    )
    catacombs = models.Location(
        campaign_id=campaign.id,
        name="Catacombs",
        description="Ancient burial chambers beneath the temple. The source of the curse may lie here."
    )

    db.add_all([village_square, temple, forest, catacombs])
    db.flush()

    # Create NPCs
    elder_mareth = models.NPC(
        campaign_id=campaign.id,
        location_id=village_square.id,
        name="Elder Mareth",
        description="The village elder, weathered and desperate. She knows more than she's telling.",
        role="quest_giver"
    )

    priest_aldric = models.NPC(
        campaign_id=campaign.id,
        location_id=temple.id,
        name="Priest Aldric",
        description="The temple's priest, driven mad by visions of the old gods.",
        role="antagonist"
    )

    merchant_kael = models.NPC(
        campaign_id=campaign.id,
        location_id=village_square.id,
        name="Kael the Merchant",
        description="A traveling merchant with mysterious goods and questionable morals.",
        role="merchant"
    )

    sick_child = models.NPC(
        campaign_id=campaign.id,
        location_id=village_square.id,
        name="Young Elara",
        description="A child afflicted by the plague, barely clinging to life.",
        role="victim"
    )

    shadow_being = models.NPC(
        campaign_id=campaign.id,
        location_id=catacombs.id,
        name="The Shadow",
        description="An ancient entity bound beneath the temple, source of the plague.",
        role="final_boss"
    )

    db.add_all([elder_mareth, priest_aldric, merchant_kael, sick_child, shadow_being])
    db.flush()

    # ============ NARRATIVE NODES ============

    # Node 1: Start
    node_start = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=village_square.id,
        title="Arrival at Thornhaven",
        description="""You arrive at Thornhaven as dusk falls. The village square is empty save for a few huddled figures.

The plague has struck hard here. Bodies lie covered in the streets, and the stench of death fills the air. Elder Mareth approaches you, her eyes filled with desperate hope.

"Thank the gods you've come," she rasps. "The plague spreads faster each day. The temple priest claims it's divine punishment, but I believe something darker is at work. Will you help us?"

You notice a merchant packing his wagon, preparing to flee. And in the corner, a young girl lies shivering with fever.""",
        node_type="story"
    )
    db.add(node_start)
    db.flush()

    # Node 2: Investigate Temple
    node_temple_approach = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=temple.id,
        title="The Old Temple",
        description="""The temple looms before you, its architecture predating the village by centuries. Strange symbols cover the walls, and a sickly green light pulses from within.

Priest Aldric stands at the entrance, blocking your path. His eyes are wild, and he clutches a ceremonial dagger.

"Turn back!" he shouts. "The old gods demand sacrifice! Only blood can cleanse this plague! The child must be given to them!"

You realize he's talking about young Elara. The priest is clearly mad, but there's genuine terror in his eyes.""",
        node_type="story"
    )
    db.add(node_temple_approach)
    db.flush()

    # Node 3: Talk to Merchant
    node_merchant_talk = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=village_square.id,
        title="The Merchant's Offer",
        description="""Kael eyes you suspiciously as you approach. His wagon is loaded with supplies - and you notice several vials of what might be medicine.

"Looking to leave, or looking to die?" he asks. "This plague is unnatural. I've seen things... things in the catacombs beneath the temple. Something ancient stirs there."

He lowers his voice. "I have an... antidote of sorts. Expensive, and there's only enough for one person. Could save the girl, or..." he looks at you meaningfully, "keep you safe if you're planning to face what's down there."

The price he names is astronomical. You don't have that kind of coin.""",
        node_type="story"
    )
    db.add(node_merchant_talk)
    db.flush()

    # Node 4: Charisma test to persuade merchant
    node_persuade_merchant = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=village_square.id,
        title="Persuade the Merchant",
        description="""You attempt to convince Kael to give you the antidote. His eyes narrow as he weighs your words against his greed.""",
        node_type="skill_test",
        skill_test_stat="charisma",
        skill_test_difficulty=15
    )
    db.add(node_persuade_merchant)
    db.flush()

    # Node 5: Successfully persuaded merchant
    node_merchant_success = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=village_square.id,
        title="A Rare Act of Mercy",
        description="""Your words strike a chord. Kael sighs and hands you one vial.

"Take it. My conscience has been heavy enough lately." He pauses. "But hear this - that thing in the catacombs, it feeds on life force. The plague is just a symptom. You'll need to destroy its heart - a corrupted crystal in the deepest chamber. But doing so might release something worse."

He rides away into the night, leaving you with a vial and a terrible choice ahead.""",
        node_type="story"
    )
    db.add(node_merchant_success)
    db.flush()

    # Node 6: Failed to persuade merchant
    node_merchant_failure = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=village_square.id,
        title="Cold Calculation",
        description="""Kael laughs bitterly. "Nice try. I've heard every sob story there is. This plague will spread beyond this village soon. I need to protect myself."

He leaves with the antidote. Young Elara will have to rely on other means - if any exist.

But he did mention something useful: the source of the plague lies in the catacombs, tied to some kind of corrupted crystal. Destroying it might end this... or make things worse.""",
        node_type="story"
    )
    db.add(node_merchant_failure)
    db.flush()

    # Set success/failure nodes for persuasion test
    node_persuade_merchant.success_node_id = node_merchant_success.id
    node_persuade_merchant.failure_node_id = node_merchant_failure.id

    # Node 7: Enter the Catacombs
    node_enter_catacombs = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=catacombs.id,
        title="Into the Depths",
        description="""You descend into the catacombs beneath the temple. The air grows thick with malevolent energy. Ancient bones line the walls, and the green light grows brighter.

In the central chamber, you find it: a massive crystal, pulsing with corrupted energy. Dark veins spread from it like a cancer, and you can feel it draining the life from everything around it.

A shadow detaches from the crystal - a being of pure darkness, with eyes like dying stars.

"MORTAL," it speaks directly into your mind. "I am bound here, yes, but I am also the only thing holding back the REAL horror. Break my crystal, and the Void will consume this world. Keep me bound, and the plague continues. Your choice."

You sense it's telling a twisted version of the truth.""",
        node_type="story"
    )
    db.add(node_enter_catacombs)
    db.flush()

    # Node 8: Strength test to destroy crystal
    node_destroy_crystal = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=catacombs.id,
        title="Shatter the Heart",
        description="""You grip your weapon and strike at the crystal with all your might, ignoring the Shadow's warnings.""",
        node_type="skill_test",
        skill_test_stat="strength",
        skill_test_difficulty=12
    )
    db.add(node_destroy_crystal)
    db.flush()

    # Node 9: Successfully destroyed crystal - ENDING 1 (Sacrifice)
    node_crystal_destroyed = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=catacombs.id,
        title="The Price of Freedom",
        description="""The crystal shatters with a deafening crack. The Shadow screams and dissipates.

For a moment, you feel triumph. Then you feel IT - a tear in reality itself. The Shadow was telling the truth. Something vast and hungry stirs beyond the veil.

You have seconds to act. Using every ounce of your willpower, you throw yourself into the breach, offering your own life force to seal the gap.

As your consciousness fades, you see the plague receding from the village. Thornhaven is saved. The people will never know what you sacrificed.

Your last thought is of young Elara, who will live to see tomorrow.""",
        node_type="story",
        is_ending=True,
        ending_type="sacrifice"
    )
    db.add(node_crystal_destroyed)
    db.flush()

    # Node 10: Failed to destroy crystal
    node_crystal_failed = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=catacombs.id,
        title="Not Strong Enough",
        description="""You strike the crystal repeatedly, but your blows barely crack its surface. The Shadow laughs.

"Pathetic. You cannot destroy what you do not understand."

Exhausted, you must choose another path. Perhaps there's a way to work WITH the Shadow, or to escape and warn others.""",
        node_type="story"
    )
    db.add(node_crystal_failed)
    db.flush()

    node_destroy_crystal.success_node_id = node_crystal_destroyed.id
    node_destroy_crystal.failure_node_id = node_crystal_failed.id

    # Node 11: Make a deal with the Shadow - ENDING 2 (Dark Triumph)
    node_deal_with_shadow = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=catacombs.id,
        title="A Devil's Bargain",
        description="""You lower your weapon. "What if we made a deal?"

The Shadow pulses with interest. "Clever mortal. Yes... I can stop the plague. I can even give you power. In exchange, you become my agent in the world above. You'll spread my influence, slowly, subtly. And when the time is right, you'll free me completely."

The plague ends that very night. Young Elara recovers. The village celebrates you as a hero.

But you feel the Shadow's presence in your mind, always watching, always whispering. You've saved Thornhaven... but at what cost to the world?

Years later, you don't recognize the person you've become. The power was intoxicating, the corruption gradual. You rule Thornhaven now, with an iron fist and dark magic. The Shadow is pleased.""",
        node_type="story",
        is_ending=True,
        ending_type="dark_triumph"
    )
    db.add(node_deal_with_shadow)
    db.flush()

    # Node 12: Flee and warn others - ENDING 3 (Escape)
    node_flee = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=forest.id,
        title="The Bitter Truth",
        description="""You make the hardest decision of your life: you run.

Thornhaven cannot be saved. The Shadow's power is too great, and destroying the crystal risks dooming the entire world. The only responsible choice is to flee and warn the kingdom.

As you ride away, you look back one last time. Smoke rises from Thornhaven. The plague will take everyone - Elder Mareth, young Elara, all of them.

You reach the capital and report to the crown. A quarantine is established. Thornhaven is burned to the ground from a distance, every soul lost.

You saved thousands, perhaps millions. But the screams of the innocent haunt your dreams. Were you a hero or a coward? You'll never know.""",
        node_type="story",
        is_ending=True,
        ending_type="escape"
    )
    db.add(node_flee)
    db.flush()

    # Node 13: Confront the Priest
    node_confront_priest = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=temple.id,
        title="Stop the Madman",
        description="""You confront Priest Aldric directly. He's raving about blood sacrifice and ancient gods.

"The child must die! The gods demand it! I've seen it in visions!"

You realize he's completely mad - but he might also be partially right. The old gods might accept a sacrifice to end the plague. But killing an innocent child...

Could you live with yourself?""",
        node_type="story"
    )
    db.add(node_confront_priest)
    db.flush()

    # Node 14: Agility test to stop priest without killing
    node_stop_priest = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=temple.id,
        title="Lightning Reflexes",
        description="""Aldric lunges for the child with his dagger. You must react instantly to save her without killing him.""",
        node_type="skill_test",
        skill_test_stat="agility",
        skill_test_difficulty=14
    )
    db.add(node_stop_priest)
    db.flush()

    # Node 15: Successfully stopped priest
    node_priest_stopped = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=temple.id,
        title="Saved the Child",
        description="""Your reflexes are sharp. You disarm Aldric and knock him unconscious before he can harm Elara.

The child is safe - for now. But the plague still rages, and you've made an enemy of the temple priest.

Elder Mareth arrives. 'Thank you. But now we must find another solution. The catacombs... that is where this started. Are you brave enough to face what lies below?'""",
        node_type="story"
    )
    db.add(node_priest_stopped)
    db.flush()

    # Node 16: Failed to stop priest - dark outcome
    node_priest_not_stopped = models.NarrativeNode(
        campaign_id=campaign.id,
        location_id=temple.id,
        title="Too Slow",
        description="""You move to stop him, but Aldric is faster than he looks. His dagger flashes, and young Elara's scream is cut short.

The deed is done. The child is dead.

Aldric collapses, weeping. "It had to be done... the gods... they promised..."

Remarkably, over the next few days, the plague does begin to recede. The old gods accepted the sacrifice.

Thornhaven is saved. But you can never forget the price - or that you failed to prevent it. Elder Mareth won't even look at you.

You leave the village in shame, forever haunted.""",
        node_type="story",
        is_ending=True,
        ending_type="failed_to_save"
    )
    db.add(node_priest_not_stopped)
    db.flush()

    node_stop_priest.success_node_id = node_priest_stopped.id
    node_stop_priest.failure_node_id = node_priest_not_stopped.id

    # ============ CHOICES ============

    # Start node choices
    choice_start_temple = models.Choice(
        node_id=node_start.id,
        text="Investigate the temple and confront the priest",
        target_node_id=node_temple_approach.id,
        order=1
    )

    choice_start_merchant = models.Choice(
        node_id=node_start.id,
        text="Talk to the merchant before he flees",
        target_node_id=node_merchant_talk.id,
        order=2
    )

    choice_start_catacombs = models.Choice(
        node_id=node_start.id,
        text="Go directly to the catacombs beneath the temple",
        target_node_id=node_enter_catacombs.id,
        order=3,
        conditions={"min_strength": 12}  # Only if strong enough
    )

    db.add_all([choice_start_temple, choice_start_merchant, choice_start_catacombs])

    # Temple approach choices
    choice_temple_confront = models.Choice(
        node_id=node_temple_approach.id,
        text="Stop the priest from harming the child",
        target_node_id=node_stop_priest.id,
        order=1
    )

    choice_temple_catacombs = models.Choice(
        node_id=node_temple_approach.id,
        text="Ignore the priest and head to the catacombs",
        target_node_id=node_enter_catacombs.id,
        order=2,
        effects={"set_flag": "ignored_priest"}
    )

    db.add_all([choice_temple_confront, choice_temple_catacombs])

    # Merchant talk choices
    choice_merchant_persuade = models.Choice(
        node_id=node_merchant_talk.id,
        text="Try to persuade him to give you the antidote (Charisma test)",
        target_node_id=node_persuade_merchant.id,
        order=1
    )

    choice_merchant_steal = models.Choice(
        node_id=node_merchant_talk.id,
        text="Attempt to steal the antidote (Agility test)",
        target_node_id=node_persuade_merchant.id,  # Reuse same test
        order=2,
        effects={"set_flag": "stole_from_merchant"}
    )

    choice_merchant_forget = models.Choice(
        node_id=node_merchant_talk.id,
        text="Let him go and focus on the real source",
        target_node_id=node_enter_catacombs.id,
        order=3
    )

    db.add_all([choice_merchant_persuade, choice_merchant_steal, choice_merchant_forget])

    # After merchant success
    choice_merchant_success_save = models.Choice(
        node_id=node_merchant_success.id,
        text="Give the antidote to young Elara",
        target_node_id=node_enter_catacombs.id,
        order=1,
        effects={"set_flag": "saved_elara", "add_item": "empty_vial"}
    )

    choice_merchant_success_keep = models.Choice(
        node_id=node_merchant_success.id,
        text="Keep the antidote for yourself (you'll need strength for what's ahead)",
        target_node_id=node_enter_catacombs.id,
        order=2,
        effects={"add_strength": 2, "add_item": "antidote"}
    )

    db.add_all([choice_merchant_success_save, choice_merchant_success_keep])

    # After merchant failure
    choice_merchant_failure_cont = models.Choice(
        node_id=node_merchant_failure.id,
        text="Head to the catacombs to end this",
        target_node_id=node_enter_catacombs.id,
        order=1
    )

    db.add(choice_merchant_failure_cont)

    # Catacombs - major decision point
    choice_catacombs_destroy = models.Choice(
        node_id=node_enter_catacombs.id,
        text="Destroy the crystal, whatever the cost",
        target_node_id=node_destroy_crystal.id,
        order=1
    )

    choice_catacombs_deal = models.Choice(
        node_id=node_enter_catacombs.id,
        text="Make a deal with the Shadow",
        target_node_id=node_deal_with_shadow.id,
        order=2
    )

    choice_catacombs_flee = models.Choice(
        node_id=node_enter_catacombs.id,
        text="Flee and warn the kingdom - Thornhaven is doomed",
        target_node_id=node_flee.id,
        order=3
    )

    db.add_all([choice_catacombs_destroy, choice_catacombs_deal, choice_catacombs_flee])

    # Failed to destroy crystal
    choice_failed_crystal_deal = models.Choice(
        node_id=node_crystal_failed.id,
        text="Make a deal with the Shadow instead",
        target_node_id=node_deal_with_shadow.id,
        order=1
    )

    choice_failed_crystal_flee = models.Choice(
        node_id=node_crystal_failed.id,
        text="Flee and warn others",
        target_node_id=node_flee.id,
        order=2
    )

    db.add_all([choice_failed_crystal_deal, choice_failed_crystal_flee])

    # After stopping priest successfully
    choice_priest_stopped_catacombs = models.Choice(
        node_id=node_priest_stopped.id,
        text="Yes. Take me to the catacombs.",
        target_node_id=node_enter_catacombs.id,
        order=1,
        effects={"add_xp": 50, "set_flag": "saved_child"}
    )

    db.add(choice_priest_stopped_catacombs)

    # Set campaign start node
    campaign.start_node_id = node_start.id

    db.commit()
    print("Campaign seeded successfully!")
    print(f"- Campaign ID: {campaign.id}")
    print(f"- Start Node ID: {node_start.id}")
    print(f"- Total Nodes: ~16")
    print(f"- Possible Endings: 4 (Sacrifice, Dark Triumph, Escape, Failed)")
