Rejsekort API
=============

Non-official API to extract personal travel information from Rejsekort.

**Caution:** this API has access to everything within Rejsekort Self Service. Be careful.

Python
----

Create a file in the root of the project called `creds.ini` with the following content:

    [creds]
    username = <username>
    password = <password>

You can create a username and password at the [Rejsekort Self Service](https://selvbetjening.rejsekort.dk).

Then you are able to run [rejsekort-login-test.ipynb](rejsekort-login-test.ipynb) to test the login functionality.

	pip install bs4 jupyter pandas requests
	jupyter notebook .

Node
----

	npm install superagent cheerio
	node fetch-travels-async.js <username> <password>

The script will output all travels from the last 13 months (Rejsekort limit) formatted for inclusion in Greenbit.