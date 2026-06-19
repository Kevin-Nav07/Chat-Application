function extractPathParams(pattern, url) {
    //example:pattern : 'users/:id
    //users/friends/:name
    //friends/:id/:name
    //friends/:id/user
    //extract all of the : from the text into variables or a map
    //input: the pattern I expect,
    //url: the url I have. We should expect every url to be of the correct url format as it is already validated, and we should expect
    // the url to follow the same format as the endpoint we expect, this merely extracts the variables into a map
    //how do we take a url and take the variables out given a pattern. We can look through the url until the instance of that pattern is found
    //e.g if the pattern is users/:id/:name then the values we need to look for are the ones in the :id place. 
    //split the string by /

}