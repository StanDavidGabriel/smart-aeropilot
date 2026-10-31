import unittest
from queue_logic import Box, assign_items, person_extra_seconds, lane_wait_seconds, fused_count

class RulesTest(unittest.TestCase):
    def test_backpack(self): self.assertEqual(person_extra_seconds(['backpack']),120)
    def test_suitcase(self): self.assertEqual(person_extra_seconds(['suitcase']),90)
    def test_laptop(self): self.assertEqual(person_extra_seconds(['laptop']),60)
    def test_handbag(self): self.assertEqual(person_extra_seconds(['handbag']),30)
    def test_nothing(self): self.assertEqual(person_extra_seconds([]),0)
    def test_fusion(self): self.assertAlmostEqual(fused_count(10,20),13)
    def test_base(self):
        person=assign_items([Box(.05,.2,.1,.5,.9,'person')])
        self.assertEqual(lane_wait_seconds(person,1),30)
    def test_item_assignment(self):
        people=assign_items([Box(.05,.2,.1,.5,.9,'person'),Box(.07,.3,.05,.1,.8,'backpack')])
        self.assertEqual(people[0].items,['backpack'])
        self.assertEqual(lane_wait_seconds(people,1),150)
    def test_unattached_item(self):
        people=assign_items([Box(.05,.2,.1,.5,.9,'person'),Box(.8,.3,.05,.1,.8,'backpack')])
        self.assertEqual(people[0].items,[])

if __name__ == '__main__': unittest.main()
