function main(){
    //login
    this.login = '';
    this.password = '';
    this.authErrorMessage = '';
    this.isAuth = false;
    this.authToken = '';
    //Loader
    this.isLoading = false;

    //DataView 
    this.isLoginModalVisible = false;
    this.isMainScreenVisible = false;
    this.documentList = [];
    //request
    this.request = new request();

    this.singIn = async function()  {
        // const {response, error} = await client.login(this.login, this.password)
        let response = await this.request.post('/auth/login', {email: this.login, password: this.password});
        if(response?.data) {
            this.isLoginModalVisible = false;
            this.isMainScreenVisible = true;
            this.isAuth = true;
            this.authToken = response.data.access_token;
            this.getDocuments();
        }
        if(response?.errors) {
            this.authErrorMessage = 'Неверная почта или пароль';
            setTimeout(()=>{this.authErrorMessage = ""}, 5000)    
        }
    }

    this.getDocuments = async function() {
        let response = await this.request.get(`/items/Documents?access_token=${this.authToken}&fields[]=*
                                                                                              &fields[]=Signatories.directus_users_id.id
                                                                                              &fields[]=Signatories.directus_users_id.first_name
                                                                                              &fields[]=managers_signed.directus_users_id.id
                                                                                              &fields[]=managers_signed.directus_users_id.first_name
                                                                                              `);
        response.data.forEach(document => {
            if(!this.documentList.find(elem => elem.id == document.id)){
                let signatories = document.Signatories.map(elem => {
                    return new signatore(elem.directus_users_id.first_name, elem.directus_users_id.id);
                })
                let managers_signed = document.managers_signed.map(elem => {
                    return new signatore(elem.directus_users_id.first_name, elem.directus_users_id.id);
                })
                console.log(managers_signed);
                this.documentList.push(new Document(document.Title, document.Body, signatories, document.id, managers_signed, document.user_created))
            }
        });
        console.log(this.documentList);
    }
    
    ko.track(this);
}

function Document(title, body, signatories, id, managers_signed, user_created) {
    this.id = id;
    this.title = title;
    this.body = body;
    this.signatories = signatories;
    this.managers_signed = managers_signed;
    this.user_created = user_created;

    this.addOrRemoveSignatore = function() {
        if(managers_signed.find(manager => manager.id == this.id)){
            managers_signed.remove(this);
        }
        else {
            managers_signed.push(this);
        }
        console.log(managers_signed)
    }

    this.isSigned = function(item) {
        if(managers_signed.find(manager => manager.id == item.id)){
            return true;
        }
        else {
            return false;
        }
    }

    ko.track(this);
}

function signatore(first_name, id) {
    this.first_name = first_name;
    this.id = id;
}

function request() {
    this.data = {};
    this.baseUrl = 'http://localhost:8010/proxy';
    this.requestUrl = '';
    
    this.post = async function(url, body){
        this.requestUrl = url;
        this.data = body;
        let response = await fetch(this.baseUrl + this.requestUrl, {
            method: 'POST',
            body: JSON.stringify(this.data),
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        });
        return response.json();

    }

    this.get = async function(url) {
        this.requestUrl = url;
        let response = await fetch(this.baseUrl + this.requestUrl);
        return response.json();
    }
}

ko.applyBindings(new main());