import GSheetsAPI  from './index';
import { SportEventName } from './types';

(async () => {
    const instance = new GSheetsAPI('AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE', '1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0')

    const events = await instance.getEventsList();
    console.log('=== getEventsList ===');
    console.log(events);
    const forms = await instance.getFormsList();
    console.log('=== getFormsList ===');
    console.log(forms);

    console.log('=== getBonusPointsAllocations ===');
    console.log(await instance.getBonusPointsAllocations());
    console.log('=== getSummaryStandings ===');
    console.log(await instance.getSummaryStandings());
    console.log('=== getEventResults ===');
    console.log(await instance.getEventResults(SportEventName.Run100, 9));
    console.log('=== getYearGroupRecords ===');
    console.log(await instance.getYearGroupRecords(10));
    console.log('=== getRecordsSummaryStats ===');
    console.log(await instance.getRecordsSummaryStats());
    console.log('=== getFormResults ===');
    console.log(await instance.getFormResults(8, 'W'));
})();
