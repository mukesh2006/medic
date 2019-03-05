function(doc) {
  var types = [ 'contact', 'district_hospital', 'health_center', 'clinic', 'person' ];
  var type = doc.type === 'contact' ? doc.contact_type : doc.type;
  var idx = types.indexOf(type);
  var dead = !!doc.date_of_death;
  if (idx !== -1) {
    var name = doc.name && doc.name.toLowerCase();
    var order = dead + ' ' + idx + ' ' + name;
    emit([ order ], name);
  }
}
