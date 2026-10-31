import unittest
from unittest.mock import Mock, patch
from risk.airports import BASE_ICAO, airport_code, search_airports
from risk.scoring import *
from risk.providers import get_live_flights, map_departures, _cache
from risk.replay import get_replay

class RiskTests(unittest.TestCase):
    def test_base(self):
        self.assertEqual(BASE_ICAO, "LRCV")
        self.assertEqual(airport_code("LROP"), "OTP")
        self.assertEqual(search_airports("Craiova")[0]["iata"], "CRA")
    def test_default_weights(self):
        self.assertEqual(DEFAULT_WEIGHTS, dict(weather=.4, inbound=.35, congestion=.25))
    def test_decoder(self):
        d = decode_metar("LROP 310600Z 09005G30KT 0150 FG BKN001 OVC003")
        self.assertEqual((d['visibilityM'], d['ceilingFt'], d['gustKt'], d['fog']), (150,100,30,True))
    def test_fog(self):
        self.assertEqual(weather_severity(decode_metar("LROP 000000Z 00000KT 0150 FG BKN001"))[0], 1)
    def test_default_score(self):
        risk=compute_risk(decode_metar("LROP 000000Z 00000KT 0150 FG BKN001"), decode_metar("EDDM 000000Z CAVOK"),0,.8)
        self.assertAlmostEqual(risk['score'], .6)
    def test_levels(self):
        self.assertEqual([level_for(s) for s in [.299,.3,.599,.6,.849,.85]], ['low','medium','medium','high','high','critical'])
    def test_delay_saturates(self):
        self.assertEqual([inbound_delay_factor(s) for s in [-5,45,90,180]], [0,.5,1,1])
    def test_threshold_crossing(self):
        self.assertTrue(crossed_cancel_threshold(None,.85))
        self.assertFalse(crossed_cancel_threshold(.85,.9))
        self.assertTrue(crossed_cancel_threshold(.84,.85))
    def test_all_departures(self):
        self.assertEqual(len(map_departures([{'number':f'RO{i}'} for i in range(24)],'LROP')),24)
    def test_selected_origin(self):
        self.assertEqual(map_departures([{'number':'RO123'}],'LROP')[0]['origin'],'LROP')
    def test_provider_time(self):
        f=map_departures([{'number':'RO 1','departure':{'scheduledTime':{'utc':'2026-10-31 12:00Z'},'revisedTime':{'utc':'2026-10-31 12:00:30Z'}}}],'LROP')[0]
        self.assertEqual(f['inboundDelayMin'],1)
    def test_replay_base(self):
        self.assertEqual([f['id'] for f in get_replay('LRCV','clear')[0]],['RO641','OS792'])
    def test_empty_live_is_not_sample(self):
        self.assertEqual(get_live_flights('LROP','')['flights'],[])
    @patch('risk.providers.requests.get')
    def test_cache_is_airport_specific(self, fetch):
        _cache.clear()
        response=Mock(status_code=200)
        response.json.return_value={'departures':[{'number':'RO1'}]}
        fetch.return_value=response
        self.assertEqual(get_live_flights('LRCV','fake-test-key')['flights'][0]['origin'],'LRCV')
        self.assertEqual(get_live_flights('LROP','fake-test-key')['flights'][0]['origin'],'LROP')
        get_live_flights('LROP','fake-test-key')
        self.assertEqual(fetch.call_count,2)
    def test_icao_validation(self):
        with self.assertRaises(ValueError): get_live_flights('../bad','fake')

if __name__ == '__main__': unittest.main()
