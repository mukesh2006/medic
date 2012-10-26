var updates = require('kujua-sms/updates'),
    lists = require('kujua-sms/lists'),
    logger = require('kujua-utils').logger,
    baseURL = require('duality/core').getBaseURL(),
    appdb = require('duality/core').getDBURL(),
    querystring = require('querystring'),
    jsDump = require('jsDump'),
    fakerequest = require('couch-fakerequest'),
    helpers = require('../../test-helpers/helpers'),
    _ = require('underscore')._;


var example = {
    sms_message: {
       from: "+13125551212",
       message: '1!MSBB!2012#1#24#abcdef#1111#bbbbbb#22#15#cccccc',
       sent_timestamp: "10-01-11 18:45",
       sent_to: "+15551212",
       type: "sms_message",
       locale: "en",
       form: "MSBB"
    },
    clinic: {
        "_id": "4a6399c98ff78ac7da33b639ed60f458",
        "_rev": "1-0b8990a46b81aa4c5d08c4518add3786",
        "type": "clinic",
        "name": "Example clinic 1",
        "contact": {
            "name": "Sam Jones",
            "phone": "+13125551212"
        },
        "parent": {
            "type": "health_center",
            "contact": {
                "name": "Neal Young",
                "phone": "+17085551212"
            },
            "parent": {
                "type": "district_hospital",
                "contact": {
                    "name": "Bernie Mac",
                    "phone": "+14155551212"
                }
            }
        }
    }
};

var expected_callback = {
    data: {
        type: "data_record",
        form: "MSBB",
        related_entities: {
            clinic: null
        },
        sms_message: example.sms_message,
        from: "+13125551212",
        errors: [],
        responses: [
            {
                to: "+13125551212",
                message: "Your form submission was received, thank you."
            }
        ],
        tasks: [],
        ref_year: 2012,
        ref_month: 1,
        ref_day: 24,
        ref_rc: "abcdef",
        ref_hour: 1111,
        ref_name: "bbbbbb",
        ref_age: 22,
        ref_reason: "Autres",
        ref_reason_other: "cccccc"
    }
};


/*
 * STEP 1:
 *
 * Run add_sms and expect a callback to add a clinic to a data record which
 * contains all the information from the SMS.
 */
exports.msbb_to_record = function (test) {

    test.expect(57);

    // Data parsed from a gateway POST
    var data = {
        from: '+13125551212',
        message: '1!MSBB!2012#1#24#abcdef#1111#bbbbbb#22#15#cccccc',
        sent_timestamp: "10-01-11 18:45",
        sent_to: '+15551212'
    };

    // request object generated by duality includes uuid and query.form from
    // rewriter.
    var req = {
        uuid: '14dc3a5aa6',
        query: {form: 'MSBB'},
        method: "POST",
        headers: helpers.headers("url", querystring.stringify(data)),
        body: querystring.stringify(data),
        form: data
    };

    var resp = fakerequest.update(updates.add_sms, data, req);

    var resp_body = JSON.parse(resp[1].body);

    // assert parsing of sent_timestamp
    test.same(
        'Sat Oct 01 2011',
        new Date(resp_body.callback.data.reported_date).toDateString()
    );

    delete resp_body.callback.data.reported_date;
    
    test.same(
        resp_body.callback.options.path,
        baseURL + "/MSBB/data_record/add/facility/%2B13125551212");

    _.each([
        'ref_year', 'ref_month', 'ref_day', 'ref_rc', 'ref_hour',
        'ref_name', 'ref_age', 'ref_reason', 'ref_reason_other'
    ], function(attr) {
        test.same(
            resp_body.callback.data[attr],
            expected_callback.data[attr]);
    });

    test.same(
        resp_body.callback.data.sms_message,
        expected_callback.data.sms_message);

    test.same(
        resp_body.callback.data,
        expected_callback.data);

    step2(test, helpers.nextRequest(resp_body, 'MSBB'));

};


/*
 * STEP 2:
 *
 * Run data_record/add/facility and expect a callback to
 * check if the same data record already exists.
 */
var step2 = function(test, req) {
    
    var clinic = example.clinic;

    var viewdata = {rows: [
        {
            "key": ["+13125551212"],
            "value": clinic
        }
    ]};

    var resp = fakerequest.list(lists.data_record, viewdata, req);

    var resp_body = JSON.parse(resp.body);

    //
    // For now we do not care for duplicates,
    // so we just check that the data record gets created
    // without merging it with an existing one.
    //
    
    // If no record exists during the merge then we 
    // create a new record with POST
    test.same(resp_body.callback.options.method, "POST");
    test.same(resp_body.callback.options.path, appdb);

    // extra checks
    test.same(resp_body.callback.data.errors, []);
    test.same(
        resp_body.callback.data.sms_message,
        example.sms_message);
        
    _.each([
        'ref_year', 'ref_month', 'ref_day', 'ref_rc', 'ref_hour',
        'ref_name', 'ref_age', 'ref_reason', 'ref_reason_other'
    ], function(attr) {
        test.same(
            resp_body.callback.data[attr],
            expected_callback.data[attr]);
    });

    test.same(
        resp_body.callback.data.tasks[0].messages[0].message,
        "Année: 2012, Mois: 1, Jour: 24, Code du RC: abcdef, Heure de " +
        "départ: 1111, Nom: bbbbbb, Age: 22, Motif référence: Autres, " +
        "Si 'autre', précisez motif référence: cccccc"
    );

    step1_with_only_required_fields_defined(test);
    
};


/*
 * STEP 1 WITH ONLY REQUIRED FIELDS:
 *
 * Run add_sms and expect a callback to add a clinic to a data record which
 * contains all the information from the SMS. Do this with only the required
 * fields defined in the sms message and check that it still succeeds.
 */
var step1_with_only_required_fields_defined = function(test) {
    
    var data = {
        from: '+13125551212',
        message: '1!MSBB!2012#1#24###bbbbbb',
        sent_timestamp: "10-01-11 18:45",
        sent_to: '+15551212'
    };

    var req = {
        uuid: '14dc3a5aa6',
        query: {form: 'MSBB'},
        method: "POST",
        headers: helpers.headers("url", querystring.stringify(data)),
        body: querystring.stringify(data),
        form: data
    };

    var resp = fakerequest.update(updates.add_sms, data, req);

    var resp_body = JSON.parse(resp[1].body);

    test.same(
        resp_body.callback.options.path,
        baseURL + "/MSBB/data_record/add/facility/%2B13125551212");
    
    _.each([
        'ref_year', 'ref_month', 'ref_day', 'ref_name'
    ], function(attr) {
        test.same(
            resp_body.callback.data[attr],
            expected_callback.data[attr]);
    });

    test.same(
        resp_body.callback.data.ref_rc, null);
    test.same(
        resp_body.callback.data.ref_hour, null);

    _.each([
        'ref_age', 'ref_reason', 'ref_reason_other'
    ], function(attr) {
        test.same(
            resp_body.callback.data[attr],
            undefined);
    });

    test.same(
        resp_body.callback.data.errors, []);
        
    step2_with_only_required_fields_defined(test, helpers.nextRequest(resp_body, 'MSBB'));
    
};


/*
 * STEP 2 WITH ONLY REQUIRED FIELDS:
 *
 * Run data_record/add/facility and expect a callback to
 * check if the same data record already exists.
 */
var step2_with_only_required_fields_defined = function(test, req) {
    
    var clinic = example.clinic;

    var viewdata = {rows: [
        {
            "key": ["+13125551212"],
            "value": clinic
        }
    ]};

    var resp = fakerequest.list(lists.data_record, viewdata, req);

    var resp_body = JSON.parse(resp.body);

    test.same(resp_body.callback.options.method, "POST");
    test.same(resp_body.callback.options.path, appdb);

    test.same(
        resp_body.callback.data.errors, []);

    step1_with_extra_fields_defined(test);
    
};


/*
 * STEP 1 WITH EXTRA FIELDS:
 *
 * Run add_sms and expect a callback to add a clinic to a data record which
 * contains all the information from the SMS. Do this with extra fields
 * defined in the sms message and check that it still succeeds.
 */
var step1_with_extra_fields_defined = function(test) {
    
    var data = {
        from: '+13125551212',
        message: '1!MSBB!2012#1#24#abcdef#1111#bbbbbb#22#15#cccccc#YYY#ZZZ',
        sent_timestamp: '10-01-11 18:45',
        sent_to: '+15551212'
    };

    var req = {
        uuid: '14dc3a5aa6',
        query: {form: 'MSBB'},
        method: "POST",
        headers: helpers.headers("url", querystring.stringify(data)),
        body: querystring.stringify(data),
        form: data
    };

    var resp = fakerequest.update(updates.add_sms, data, req);

    var resp_body = JSON.parse(resp[1].body);

    test.same(
        resp_body.callback.options.path,
        baseURL + "/MSBB/data_record/add/facility/%2B13125551212");
    
    test.same(
        resp_body.callback.data.errors,
        [{code: "extra_fields", message: "Extra fields."}]);

    step2_with_extra_fields_defined(test, helpers.nextRequest(resp_body, 'MSBB'));
    
};


/*
 * STEP 2 WITH EXTRA FIELDS:
 *
 * Run data_record/add/facility and expect a callback to
 * check if the same data record already exists.
 */
var step2_with_extra_fields_defined = function(test, req) {
    
    var clinic = example.clinic;

    var viewdata = {rows: [
        {
            "key": ["+13125551212"],
            "value": clinic
        }
    ]};

    var resp = fakerequest.list(lists.data_record, viewdata, req);

    var resp_body = JSON.parse(resp.body);

    test.same(resp_body.callback.options.method, "POST");
    test.same(resp_body.callback.options.path, appdb);

    test.same(
        resp_body.callback.data.errors,
        [{code: "extra_fields", message: "Extra fields."}]);

    test.same(
        resp_body.callback.data.sms_message,
        _.extend(example.sms_message, {
            message: '1!MSBB!2012#1#24#abcdef#1111#bbbbbb#22#15#cccccc#YYY#ZZZ'
        }));
        
    _.each([
        'ref_year', 'ref_month', 'ref_day', 'ref_rc', 'ref_hour',
        'ref_name', 'ref_age', 'ref_reason', 'ref_reason_other'
    ], function(attr) {
        test.same(
            resp_body.callback.data[attr],
            expected_callback.data[attr]);
    });

    test.same(
        resp_body.callback.data.tasks[0].messages[0].message,
        "Année: 2012, Mois: 1, Jour: 24, Code du RC: abcdef, Heure de " +
        "départ: 1111, Nom: bbbbbb, Age: 22, Motif référence: Autres, " +
        "Si 'autre', précisez motif référence: cccccc"
    );

    test.done();
    
};
